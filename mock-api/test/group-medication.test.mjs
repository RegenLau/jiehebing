import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createMockServer } from '../server.mjs';

async function setup(t) {
  const server=createMockServer({now:'2026-09-10T04:00:00.000Z'});
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`; let token='';
  async function call(path, body) {
    const headers=token?{Authorization:`Bearer ${token}`} : {};
    if(body!==undefined && !(body instanceof FormData)) headers['Content-Type']='application/json';
    return (await fetch(base+'/app/core/'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)})).json();
  }
  async function ok(path,body){const r=await call(path,body);assert.equal(r.code,200,r.message);return r.data;}
  const captcha=await ok('captcha');token=(await ok('login',{username:'admin',password:'Mock123456',uuid:captcha.uuid,code:'1234'})).access_token;
  return {call,ok};
}
const card=(source,quantity=30)=>({...source,dose:'2',quantity,daily_count:3,frequency:'每日3次',times:'07:00,12:00,19:00',confirmed:true,reminders:[{time:'07:00',timing:'餐前'},{time:'12:00',timing:'餐后'},{time:'19:00',timing:'空腹'}]});

test('group drug cards preserve dose, daily reminders and calculate earliest pickup without editing source templates',async t=>{
  const api=await setup(t),catalog=await api.ok('project/catalog'),source=catalog.medication_schemes[0];
  const group=await api.ok('project/group-create',{project_id:1,name:'卡片用药测试',description:''});
  const drugs=source.drugs.slice(0,2).map((d,i)=>card(d,i?120:30));
  const medication={id:source.id,drugs,treatment_days:90,pickup_mode:'quantity',pickup_days:999,advance_days:7,quantities:drugs.map(d=>({drug_id:d.drug_id,quantity:d.quantity}))};
  const saved=await api.ok('project/group-save',{...group,medication});
  assert.equal(saved.medication.pickup_days,5,'earliest supply: 30 / 2 / 3 = 5 days; ignore client cycle');
  assert.deepEqual(saved.medication.snapshot.drugs[0].reminders,drugs[0].reminders);
  assert.equal(saved.medication.snapshot.drugs[0].frequency,'每日3次');
  assert.deepEqual((await api.ok('project/catalog')).medication_schemes,catalog.medication_schemes);
  assert.deepEqual((await api.ok(`project/group-detail?project_id=1&id=${group.id}`)).medication,saved.medication);
  for(const bad of [
    {...drugs[0],confirmed:false}, {...drugs[0],daily_count:4}, {...drugs[0],daily_count:0}, {...drugs[0],quantity:0},
    {...drugs[0],dose:'0'}, {...drugs[0],reminders:[drugs[0].reminders[0],drugs[0].reminders[0],drugs[0].reminders[2]]},
    {...drugs[0],reminders:drugs[0].reminders.map(r=>({...r,time:'25:00'}))},
    {...drugs[0],reminders:drugs[0].reminders.map(r=>({...r,timing:'不明'}))}
  ]) assert.notEqual((await api.call('project/group-save',{...saved,medication:{...medication,drugs:[bad,...drugs.slice(1)]}})).code,200);
  assert.deepEqual((await api.ok(`project/group-detail?project_id=1&id=${group.id}`)).medication,saved.medication,'invalid cards must not partially mutate group');
  const patient=await api.ok('patient/save',{name:'每日三次测试',mobile:'13900007654',gender:1,birth_date:'1990-01-01',project_id:1,group_id:group.id,owner_id:1,enroll_date:'2026-09-10',offline_confirmed:true,consent_confirmed:true});
  const treatment=await api.ok('patient/treatment',{user_id:patient.id,start_date:'2026-09-10',reason:'采用分组方案'});
  assert.deepEqual(treatment.drugs[0].times,['07:00','12:00','19:00']);
  assert.deepEqual(treatment.drugs[0].reminders,drugs[0].reminders);
  const adjustedTimes=['07:30','12:30','19:30','21:30'];
  const adjusted=await api.ok('patient/treatment',{user_id:patient.id,start_date:'2026-09-10',treatment_days:90,reason:'调整当前患者提醒时间',adjusted:true,
    drugs:treatment.drugs.map((drug,index)=>({...drug,times:index?drug.times:adjustedTimes}))});
  assert.deepEqual(adjusted.drugs[0].times,adjustedTimes);
  assert.deepEqual(adjusted.drugs[0].reminders.map(item=>item.timing),[...drugs[0].reminders.map(item=>item.timing),'餐后'],'修改每日次数后按槽位沿用分组服药时机，新时点默认餐后');
  const plans=await api.ok(`medication-plan/index?user_id=${patient.id}&scope=today&current=1&size=100`);
  const activePlans=plans.list.filter(plan=>plan.status===0);
  assert.equal(activePlans.length,adjusted.drugs.reduce((sum,drug)=>sum+drug.times.length,0));
  assert.ok(activePlans.every(p=>p.medication_timing===adjusted.drugs.find(d=>d.drug_id===p.common_medicine_id).reminders.find(r=>r.time===p.plan_time).timing));
});

test('prescription mock requires a local image and custom group cards can be saved without a reusable scheme',async t=>{
  const api=await setup(t);
  assert.notEqual((await api.call('project/recognize-prescription',{url:'https://invalid.example/rx.png'})).code,200);
  const form=new FormData();form.append('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8x8AAAAASUVORK5CYII=','base64')],{type:'image/png'}),'prescription-demo.png');
  const uploaded=await api.ok('file/upload-file',form);
  const recognized=await api.ok('medication-scheme/recognize-prescription',{url:uploaded.url});
  assert.equal(recognized.mode,'mock');assert.ok(recognized.drugs.length>0);assert.ok(recognized.drugs.every(d=>d.confirmed===false));
  const group=await api.ok('project/group-create',{project_id:1,name:'自定义分组卡片',description:''});
  const drugs=recognized.drugs.map(d=>({...d,confirmed:true}));
  const saved=await api.ok('project/group-save',{...group,medication:{id:0,drugs,prescription_url:uploaded.url,treatment_days:10,pickup_mode:'quantity',pickup_days:30,advance_days:3,quantities:drugs.map(d=>({drug_id:d.drug_id,quantity:d.quantity}))}});
  assert.equal(saved.medication.id,0);assert.equal(saved.medication.pickup_days,10,'cycle is capped by course');
  assert.equal(saved.medication.prescription_url,uploaded.url);assert.equal(saved.medication.snapshot.name,'自定义分组卡片用药方案');
});

test('scheme page cards persist recognition and reminder settings while group snapshots remain independent',async t=>{
  const api=await setup(t),source=await api.ok('medication-scheme/detail?id=1');
  const original=await api.ok('project/group-detail?project_id=1&id=1');
  assert.equal(original.medication.pickup_mode,'quantity');
  assert.ok(original.medication.snapshot.drugs.every(d=>d.confirmed&&d.reminders.length===d.daily_count));
  const rifampicin=original.medication.snapshot.drugs.find(d=>d.name==='利福平胶囊');
  assert.equal(rifampicin.specification,'0.3g×50粒/瓶');
  assert.equal(rifampicin.unit,'粒');
  const drugs=source.drugs.map(d=>card(d,30));
  drugs[0]={...drugs[0],name:'自定义药品名称',specification:'自定义药品规格'};
  const body={...source,name:'卡片通用方案',treatment_days:90,pickup_days:99,pickup_mode:'quantity',advance_days:7,reason:'更新药品卡片',drugs};
  assert.notEqual((await api.call('medication-scheme/save',{...body,drugs:drugs.map(d=>({...d,confirmed:false}))})).code,200);
  assert.notEqual((await api.call('medication-scheme/save',{...body,drugs:drugs.map((d,index)=>index?d:{...d,name:' '})})).code,200);
  assert.notEqual((await api.call('medication-scheme/save',{...body,drugs:drugs.map((d,index)=>index?d:{...d,specification:' '})})).code,200);
  const saved=await api.ok('medication-scheme/save',body);
  assert.equal(saved.pickup_days,5);
  assert.equal(saved.treatment_days,90);
  assert.equal(saved.drugs[0].name,'自定义药品名称');
  assert.equal(saved.drugs[0].specification,'自定义药品规格');
  assert.deepEqual(saved.drugs[0].reminders,drugs[0].reminders);
  assert.deepEqual((await api.ok(`medication-scheme/detail?id=${saved.id}`)).drugs,saved.drugs);
  assert.deepEqual((await api.ok('project/group-detail?project_id=1&id=1')).medication,original.medication);
  assert.notEqual((await api.call('medication-scheme/save',{...body,version:saved.version,prescription_url:'https://invalid.example/rx.png'})).code,200);
});
