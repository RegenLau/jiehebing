export function registerMedicationSchemes({core,db,assert,find,page,clean,timestamp,nextId}) {
  const integer=(v,label,min,max)=>{assert(Number.isInteger(v)&&v>=min&&v<=max,`${label}应为${min}至${max}的整数`);return v;};
  const text=(v,label,max,required=false)=>{const s=clean(v);assert(s.length<=max&&(!required||s),`请填写有效的${label}`);return s;};
  const snapshot=row=>{const {history,...data}=row;return structuredClone(data);};
  const record=(row,admin,before,reason)=>{row.history ||= [];row.history.unshift({time:timestamp(),operator:admin.realname||admin.username,reason,before,after:snapshot(row)});};
  core('GET','medication-scheme/index',({query:q})=>{
    assert(q.status===undefined||q.status===''||['0','1'].includes(q.status),'状态不合法');
    const rows=db.medicationSchemes.filter(r=>(!q.keyword||r.name.includes(clean(q.keyword)))&&(q.status===undefined||q.status===''||r.status===Number(q.status)));
    return page([...rows].sort((a,b)=>b.id-a.id).map(snapshot),q);
  });
  core('GET','medication-scheme/detail',({query:q})=>find(db.medicationSchemes,q.id,'用药方案'));
  core('POST','medication-scheme/save',({body:b,admin})=>{
    const old=b.id===undefined?null:find(db.medicationSchemes,b.id,'用药方案');
    if(old) assert(b.version===old.version,'方案已更新，请刷新后编辑');
    const name=text(b.name,'方案名称',100,true),description=text(b.description,'方案说明',1000),reason=text(b.reason,'修改原因',300,Boolean(old));
    assert(!db.medicationSchemes.some(r=>r!==old&&r.name.toLowerCase()===name.toLowerCase()),'方案名称已存在');
    const treatment_days=integer(b.treatment_days,'治疗天数',1,3650),pickup_days=integer(b.pickup_days,'取药周期',1,3650),advance_days=integer(b.advance_days,'提前提醒天数',0,pickup_days);
    assert(Array.isArray(b.drugs)&&b.drugs.length>0&&b.drugs.length<=50,'请添加1至50种药品');
    assert(new Set(b.drugs.map(d=>d.drug_id)).size===b.drugs.length,'药品不能重复');
    const drugs=b.drugs.map(d=>{
      integer(d.drug_id,'药品编号',1,99999999);
      const medicine=find(db.commonMedicines,d.drug_id,'药品');
      assert(medicine.status===1||old?.drugs.some(r=>r.drug_id===d.drug_id),'停用药品不能新增到方案');
      const dose=text(d.dose,'单次用量',20,true); assert(/^\d+(\.\d{1,3})?$/.test(dose)&&Number(dose)>0,'单次用量必须大于0');
      const times=text(d.times,'服药时间',100,true).split(/[，,]/).map(s=>s.trim());
      assert(times.every(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t))&&new Set(times).size===times.length,'请填写有效且不重复的服药时间，多个时间用逗号分隔');
      return {drug_id:medicine.id,name:medicine.common_name,specification:medicine.specification,dose,unit:text(d.unit,'用量单位',20,true),frequency:text(d.frequency,'用药频次',60,true),times:times.join(','),precautions:text(d.precautions,'注意事项',1000),quantity:integer(d.quantity,'默认发药数量',1,100000)};
    });
    const row=old||{id:nextId(db.medicationSchemes),status:1,history:[]},before=old?snapshot(old):null;
    Object.assign(row,{name,description,treatment_days,pickup_days,advance_days,drugs,revision:(old?.revision||1)+1,updated_at:timestamp()});row.version=`V${row.revision}`;
    record(row,admin,before,reason||'新增用药方案');if(!old)db.medicationSchemes.push(row);return row;
  });
  core('POST','medication-scheme/status',({body:b,admin})=>{
    const row=find(db.medicationSchemes,b.id,'用药方案');assert(b.version===row.version,'方案已更新，请刷新后操作');integer(b.status,'状态',0,1);assert(b.status!==row.status,'状态未变化');
    const reason=text(b.reason,'变更原因',300,true),before=snapshot(row);row.status=b.status;row.revision=(row.revision||1)+1;row.version=`V${row.revision}`;row.updated_at=timestamp();record(row,admin,before,reason);return row;
  });
}
