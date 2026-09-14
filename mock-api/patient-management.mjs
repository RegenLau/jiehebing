import { generateExecution } from './followup.mjs';
import { effectiveProjectStatus } from './project-status.mjs';
import { actualTreatmentsFor, currentTreatmentFor, treatmentStateFor, upcomingTreatmentFor } from './patient-tasks.mjs';
import { refreshPatientStudyState } from './patient-study-state.mjs';
import { executionSnapshotFor, snapshotGroupExecution } from './execution-snapshot.mjs';

export function registerPatientManagement({core,db,assert,find,page,clean,isDate,timestamp,nextId,today,shiftDate}) {
  db.patientTreatments=[];db.dispensings=[];db.patientHistory=[];db.patientConfirmationIssues||=[];db.patientExecutionSnapshots||=[];db.onboardingRequests||=[];
  const states=['待启用','治疗中','暂停用药','已完成','提前退出','失访'];
  const manualTransitions={
    '待启用':['提前退出','失访'],
    '治疗中':['暂停用药','提前退出','失访'],
    '暂停用药':['治疗中','提前退出','失访']
  };
  const text=(v,label,max=100,required=true)=>{const s=clean(v);assert(s.length<=max&&(!required||s),`请填写有效的${label}`);return s;};
  const date=(v,label)=>{assert(isDate(v),`请填写有效的${label}`);return v;};
  const ageFromBirthDate=(birthDate)=>{const [by,bm,bd]=birthDate.split('-').map(Number),[y,m,d]=today().split('-').map(Number);return y-by-(m<bm||m===bm&&d<bd?1:0);};
  const positive=(v,label,max=100000)=>{assert(typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=max,`请填写有效的${label}`);return v;};
  const integer=(v,label,min=1,max=3650)=>{assert(Number.isInteger(v)&&v>=min&&v<=max,`请填写有效的${label}`);return v;};
  const dateSpan=(start,end)=>Math.floor((Date.parse(`${end}T00:00:00Z`)-Date.parse(`${start}T00:00:00Z`))/86400000)+1;
  const log=(patient,admin,action,reason,before,after)=>{db.patientHistory.unshift({id:nextId(db.patientHistory),user_id:patient.id,time:timestamp(),operator:admin.realname||admin.username,action,reason,before:structuredClone(before),after:structuredClone(after)});};
  const parseTimes=(value)=>{const times=(Array.isArray(value)?value:clean(value).split(/[，,]/)).map(t=>clean(t));assert(times.length>0&&times.length<=8&&times.every(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t))&&new Set(times).size===times.length,'服药时间应为不重复的HH:mm，最多8次');return times;};
  const inScope=(patient,query,dateValue=patient.enroll_date)=>(!query.project_id||patient.project_id===Number(query.project_id))&&(!query.group_id||patient.group_id===Number(query.group_id))&&(!query.start_date||dateValue>=query.start_date)&&(!query.end_date||dateValue<=query.end_date);

  const savePatient=({body:b,admin})=>{
    const old=b.id===undefined?null:find(db.patients,b.id,'患者');if(old&&b.revision!==undefined)assert(b.revision===(old.revision||1),'档案已更新，请刷新后编辑');
    const name=text(b.name,'姓名',60),mobile=text(b.mobile,'手机号',20);assert(/^1\d{10}$/.test(mobile)||old?.mobile===mobile,'请填写11位手机号');assert(!db.patients.some(p=>p!==old&&p.mobile===mobile),'该手机号已有患者档案');
    assert([1,2].includes(b.gender),'请选择性别');const birth_date=date(b.birth_date,'出生日期'),age=ageFromBirthDate(birth_date);assert(age>=0&&age<=120,'出生日期不合法');
    const reason=text(b.reason,'修改原因',300,Boolean(old));
    assert(old || b.project_id && b.group_id, '新增患者需登记研究项目和分组');
    let study={};let target=null;
    if(b.project_id||b.group_id){const p=find(db.projects,b.project_id,'项目');if(!old)assert(effectiveProjectStatus(p,today())!==2,'项目已结束，不能新增患者');target=find(db.projectGroups,b.group_id,'分组');assert(target.project_id===p.id,'分组不属于当前项目');assert(target.medication,'该研究分组尚未配置用药方案');assert(!old?.project_id||old.project_id===p.id&&old.group_id===target.id,'已登记入组归属不可直接覆盖，请在研究流程中处理');assert(b.offline_confirmed===true&&b.consent_confirmed===true,'请登记线下入组及知情同意确认');const owner=find(db.admins,b.owner_id,'负责人员');assert(owner.status===1,'负责账号已停用');study={project_id:p.id,project_name:p.name,group_id:target.id,group_name:target.name,medication_scheme_id:target.medication.id,medication_scheme_name:target.medication.snapshot.name,owner_id:owner.id,owner_name:owner.realname||owner.username,enroll_date:date(b.enroll_date,'入组日期'),offline_confirmed:true,consent_confirmed:true};}
    if(target&&old)assert(!db.projectGroups.some(g=>g.project_id===target.project_id&&g.id!==target.id&&g.participant_ids.includes(old.id)),'患者已在本项目其他分组');
    const row=old||{id:nextId(db.patients),created_at:timestamp(),status:1,study_state:'待启用',identity_confirmed:false,medicine_confirmed:false,last_login_at:''},before=old?structuredClone(old):{};
    for(const field of ['hospital_name','department_name','visit_type','visit_type_text','consent_date'])delete row[field];
    Object.assign(row,{name,mobile,gender:b.gender,gender_text:b.gender===1?'男':'女',birth_date,age,is_archived:1,login_enabled:true,created_via:'admin',patient_code:old?.patient_code||`TB-${String(row.id).padStart(5,'0')}`,enroll_date:old?.enroll_date||'',...study,revision:(old?.revision||0)+1,updated_at:timestamp()});
    if(old&&['name','mobile','gender','birth_date'].some(field=>before[field]!==row[field])){row.identity_confirmed=false;row.identity_confirmation=null;for(const issue of db.patientConfirmationIssues.filter(item=>item.user_id===row.id&&item.type==='identity'&&item.status==='待处理'))Object.assign(issue,{status:'已处理',resolved_at:timestamp(),resolved_by:admin.realname||admin.username});}
    if(!old){db.patients.push(row);if(target)db.patientExecutionSnapshots.push({user_id:row.id,...snapshotGroupExecution(target)});}
    if(target&&!target.participant_ids.includes(row.id)){assert(!db.projectGroups.some(g=>g.project_id===target.project_id&&g.id!==target.id&&g.participant_ids.includes(row.id)),'患者已在本项目其他分组');target.participant_ids.push(row.id);target.participants||=[];target.participants.push({id:row.id,name,mobile});target.revision++;}
    log(row,admin,old?'编辑档案':'新增档案',reason||'医生建档',before,row);return row;
  };

  const saveTreatment=({body:b,admin})=>{
    const p=find(db.patients,b.user_id,'患者');
    assert(p.group_id&&p.offline_confirmed,'请先完成研究入组登记');
    const group=find(db.projectGroups,p.group_id,'分组');
    assert(group.medication,'分组尚未配置用药方案');
    const enrollmentExecution=executionSnapshotFor(db,p)||snapshotGroupExecution(group);
    const adjusted=b.adjusted===true;
    const reason=text(b.reason,adjusted?'个体调整原因':'方案确认说明',500);
    const start_date=date(b.start_date,'方案生效日期');
    assert(start_date>=today(),'方案从今天或未来生效，不能改写过去记录');
    const existing=actualTreatmentsFor({db,patient:p});
    const current=currentTreatmentFor({db,patient:p,date:today()});
    const upcoming=upcomingTreatmentFor({db,patient:p,date:today()});
    const prior=current||upcoming||existing.at(-1)||null;
    const sourceScheme=prior?.source_scheme||enrollmentExecution.medication||group.medication;
    const defaultDays=integer(sourceScheme.treatment_days,'所属分组治疗天数');
    const sourceDrugs=sourceScheme.snapshot.drugs;
    assert(Array.isArray(sourceDrugs)&&sourceDrugs.length>0&&sourceDrugs.length<=50,'所属分组用药方案缺少药品');
    const requestedDays=adjusted?integer(Number(b.treatment_days),'治疗天数'):defaultDays;
    if(!adjusted&&!prior&&b.treatment_days!==undefined)assert(Number(b.treatment_days)===defaultDays,'未开启个体调整时须使用所属分组治疗天数');
    const course_start_date=prior?.course_start_date||prior?.start_date||start_date;
    let course_end_date;
    if(!prior)course_end_date=shiftDate(course_start_date,requestedDays-1);
    else if(b.adjust_course_end===true)course_end_date=date(b.course_end_date,'疗程结束日期');
    else course_end_date=prior.course_end_date||prior.end_date;
    assert(course_end_date>=start_date,'方案生效日期不能晚于疗程结束日期；如需延长疗程，请明确调整结束日期');
    const treatment_days=dateSpan(course_start_date,course_end_date);
    assert(treatment_days>=1&&treatment_days<=3650,'疗程范围应为1至3650天');

    let requestedDrugs=sourceDrugs;
    if(adjusted){
      assert(Array.isArray(b.drugs)&&b.drugs.length>0&&b.drugs.length<=sourceDrugs.length,'个体方案至少保留一种组内药品');
      assert(new Set(b.drugs.map(d=>d.drug_id)).size===b.drugs.length,'个体方案药品不能重复');
      requestedDrugs=b.drugs;
      for(const requested of requestedDrugs)assert(sourceDrugs.some(d=>d.drug_id===requested.drug_id),'个体方案只能调整所属分组内的药品');
    }else if(b.drugs!==undefined){
      assert(Array.isArray(b.drugs)&&b.drugs.length===sourceDrugs.length,'未开启个体调整时须使用所属分组药品');
      for(const source of sourceDrugs){
        const requested=b.drugs.find(d=>d.drug_id===source.drug_id);
        assert(requested&&String(requested.dose)===String(source.dose)&&clean(requested.unit)===clean(source.unit)&&clean(requested.frequency)===clean(source.frequency)&&parseTimes(requested.times).join(',')===parseTimes(source.times).join(','),'未开启个体调整时须使用所属分组用法用量');
      }
    }

    const drugs=requestedDrugs.map(requested=>{
      const source=sourceDrugs.find(d=>d.drug_id===requested.drug_id),medicine=find(db.commonMedicines,requested.drug_id,'药品');
      assert(source,'个体方案药品不属于所属分组');
      const dose=positive(Number(adjusted?requested.dose:source.dose),'单次用量');
      const unit=text(adjusted?requested.unit:source.unit,'单位',20);
      assert(unit===clean(source.unit),'个体调整不支持修改计量单位');
      const times=parseTimes(adjusted?requested.times:source.times);
      return {drug_id:medicine.id,name:medicine.common_name,specification:medicine.specification,dose,unit,times,reminders:times.map((time,index)=>({time,timing:source.reminders?.[index]?.timing||'餐后'})),frequency:`每日${times.length}次`,precautions:clean(source.precautions)};
    });
    const changes=[];
    const compareDrugs=prior?.drugs||sourceDrugs;
    for(const source of compareDrugs){
      const requested=drugs.find(d=>d.drug_id===source.drug_id);
      if(!requested){changes.push(`停用 ${source.name}`);continue;}
      if(String(requested.dose)!==String(source.dose))changes.push(`${source.name}单次用量 ${source.dose}${source.unit} → ${requested.dose}${requested.unit}`);
      if(requested.times.join(',')!==parseTimes(source.times).join(','))changes.push(`${source.name}服药时间 ${parseTimes(source.times).join('、')} → ${requested.times.join('、')}`);
    }
    for(const requested of drugs)if(!compareDrugs.some(source=>source.drug_id===requested.drug_id))changes.push(`恢复使用 ${requested.name}`);
    if(prior&&course_end_date!==(prior.course_end_date||prior.end_date))changes.push(`疗程结束日 ${prior.course_end_date||prior.end_date} → ${course_end_date}`);
    if(adjusted)assert(changes.length>0,'未检测到个体差异，请关闭个体调整后直接采用分组方案');

    const createdAt=timestamp();
    const effective_at=prior&&start_date===today()?createdAt:`${start_date} 00:00:00`;
    for(const existingRow of db.patientTreatments.filter(row=>row.user_id===p.id&&!row.superseded_before_start)){
      if(existingRow.start_date>=start_date)existingRow.superseded_before_start=createdAt;
      else if(existingRow.end_date>=start_date){existingRow.version_end_date=shiftDate(start_date,-1);existingRow.superseded_at=effective_at;}
    }
    const row={
      id:nextId(db.patientTreatments),user_id:p.id,source_group_id:group.id,source_revision:prior?.source_revision||enrollmentExecution.group_revision||group.revision,
      source_scheme:structuredClone(sourceScheme),schedule_snapshot:structuredClone(prior?.schedule_snapshot||enrollmentExecution),
      adjusted,adjustment_summary:changes,start_date,end_date:course_end_date,course_start_date,course_end_date,
      treatment_days,version_days:dateSpan(start_date,course_end_date),effective_at,drugs,created_at:createdAt,reason
    };
    db.patientTreatments.push(row);
    if(start_date===today()){
      p.medicine_confirmed=false;p.medication_confirmation=null;
      for(const issue of db.patientConfirmationIssues.filter(item=>item.user_id===p.id&&item.type==='medication'&&item.status==='待处理'))Object.assign(issue,{status:'已处理',resolved_at:createdAt,resolved_by:admin.realname||admin.username});
    }
    generateExecution({db,patient:p,treatment:row,group,nextId,shiftDate,timestamp});
    refreshPatientStudyState({db,patient:p,date:today()});
    log(p,admin,adjusted?'调整个体方案':'确认个体方案',reason,prior||{},row);
    return row;
  };

  const saveDispense=({body:b,admin})=>{
    const p=find(db.patients,b.user_id,'患者');
    const issued_date=date(b.issued_date,'实际发药日期');
    assert(issued_date<=today(),'实际发药不能登记未来日期');
    const available=actualTreatmentsFor({db,patient:p});
    const treatment=b.treatment_id
      ? available.find(row=>String(row.id)===String(b.treatment_id))
      : currentTreatmentFor({db,patient:p,date:today()})||upcomingTreatmentFor({db,patient:p,date:today()});
    assert(treatment,'请先确认有效的个人用药方案');
    const requestId=clean(b.client_request_id);
    if(requestId){
      const existing=db.dispensings.find(row=>row.user_id===p.id&&row.client_request_id===requestId);
      if(existing)return existing;
    }
    const reason=text(b.reason,'发药说明',500);
    assert(Array.isArray(b.items)&&b.items.length>0,'请填写发药明细');
    assert(new Set(b.items.map(i=>i.drug_id)).size===b.items.length,'发药药品不能重复');
    const items=b.items.map(i=>{const d=treatment.drugs.find(d=>d.drug_id===i.drug_id);assert(d,'药品不属于所选个体方案');return {drug_id:d.drug_id,name:d.name,unit:d.unit,quantity:positive(i.quantity,'发药数量')};});
    const row={id:nextId(db.dispensings),user_id:p.id,treatment_id:treatment.id,issued_date,items,operator:admin.realname||admin.username,reason,client_request_id:requestId||undefined,status:'有效',created_at:timestamp()};
    db.dispensings.push(row);log(p,admin,'实际发药',reason,{},row);return row;
  };

  core('GET','patient/index',({query:q})=>{
    for(const patient of db.patients)refreshPatientStudyState({db,patient,date:today()});
    return page([...db.patients].reverse().filter(p=>inScope(p,q)&&(!q.keyword||`${p.name} ${p.mobile} ${p.patient_code||''}`.includes(clean(q.keyword)))&&(!q.study_state||(p.study_state||'待启用')===q.study_state)).map(p=>{
      const current=currentTreatmentFor({db,patient:p,date:today()});
      const upcoming=upcomingTreatmentFor({db,patient:p,date:today()});
      const treatment=current||upcoming;
      return {...p,arrangement_ready:Boolean(treatment),arrangement_type:treatment?(treatment.adjusted?'个体调整':'分组方案'):'待确认方案',current_treatment_id:current?.id||null,upcoming_treatment_id:upcoming?.id||null};
    }),q);
  });
  core('GET','patient/management',({query:q})=>{
    const patient=find(db.patients,q.user_id,'患者');
    refreshPatientStudyState({db,patient,date:today()});
    const current=currentTreatmentFor({db,patient,date:today()});
    const upcoming=upcomingTreatmentFor({db,patient,date:today()});
    return {patient,current_treatment_id:current?.id||null,upcoming_treatment_id:upcoming?.id||null,treatments:db.patientTreatments.filter(r=>r.user_id===patient.id).map(row=>({...row,version_state:row.superseded_before_start?'已替换':treatmentStateFor(row,today())==='current'?'当前生效':treatmentStateFor(row,today())==='pending'?'待生效':'历史版本'})),dispensings:db.dispensings.filter(r=>r.user_id===patient.id),confirmation_issues:db.patientConfirmationIssues.filter(r=>r.user_id===patient.id),history:db.patientHistory.filter(r=>r.user_id===patient.id)};
  });
  core('POST','patient/save',savePatient);
  core('POST','patient/treatment',saveTreatment);
  core('POST','patient/dispense',saveDispense);
  core('POST','patient/dispense-correct',({body:b,admin})=>{
    const original=find(db.dispensings,b.id,'发药记录');
    const requestId=clean(b.client_request_id);
    const repeated=requestId&&db.dispensings.find(row=>row.client_request_id===requestId&&row.corrects_id===original.id);
    if(original.status==='已冲销'&&(repeated||original.void_request_id===requestId))return {original,replacement:repeated||null};
    assert(original.status!=='已冲销','该发药记录已经冲销');
    const before=structuredClone(original);
    const reason=text(b.reason,b.action==='correct'?'更正原因':'冲销原因',500);
    assert(['correct','void'].includes(b.action),'更正操作不合法');
    let replacement=null;
    if(b.action==='correct'){
      replacement=saveDispense({
        body:{
          user_id:original.user_id,
          treatment_id:original.treatment_id,
          issued_date:b.issued_date,
          items:b.items,
          reason:`更正原发药记录 #${original.id}：${reason}`,
          client_request_id:b.client_request_id
        },
        admin
      });
      replacement.corrects_id=original.id;
    }
    Object.assign(original,{
      status:'已冲销',
      void_reason:reason,
      voided_at:timestamp(),
      voided_by:admin.realname||admin.username,
      void_request_id:b.action==='void'?requestId||undefined:undefined,
      replacement_id:replacement?.id||null
    });
    const patient=find(db.patients,original.user_id,'患者');
    log(patient,admin,b.action==='correct'?'更正发药记录':'冲销发药记录',reason,before,replacement||original);
    return {original,replacement};
  });
  core('POST','patient/onboard',ctx=>{
    assert(ctx.body?.patient&&ctx.body?.treatment,'请完整填写患者档案和用药安排');
    assert(ctx.body?.dispense,'请完整填写首次发药信息，保存后才能生成取药提醒');
    const requestId=clean(ctx.body.client_request_id||ctx.body.dispense.client_request_id);
    const repeated=requestId&&db.onboardingRequests.find(row=>row.client_request_id===requestId);
    if(repeated)return repeated.result;
    assert(ctx.body.patient.id===undefined,'患者已建档，请在患者研究管理中调整');
    const keys=['patients','projectGroups','patientTreatments','dispensings','patientHistory','patientExecutionSnapshots','medicines','plans','followupTasks'];
    const backup=Object.fromEntries(keys.map(key=>[key,structuredClone(db[key])]));
    try{
      const patient=savePatient({body:ctx.body.patient,admin:ctx.admin});
      const treatment=saveTreatment({body:{...ctx.body.treatment,user_id:patient.id},admin:ctx.admin});
      const dispense=ctx.body.dispense?saveDispense({body:{...ctx.body.dispense,user_id:patient.id},admin:ctx.admin}):null;
      const result={patient,treatment,dispense};
      if(requestId)db.onboardingRequests.push({client_request_id:requestId,result});
      return result;
    }catch(error){for(const key of keys)db[key]=backup[key];throw error;}
  });
  core('POST','patient/state',({body:b,admin})=>{
    const p=find(db.patients,b.user_id,'患者'),priorState=p.study_state||'待启用';
    assert(states.includes(b.state)&&manualTransitions[priorState]?.includes(b.state),'当前研究状态不支持该变更');
    const reason=text(b.reason,'状态变更原因',500),effective_date=date(b.effective_date,'生效日期');
    assert(effective_date===today(),'当前仅支持当天生效，请当天登记');
    if(b.state==='治疗中')assert(p.offline_confirmed&&db.patientTreatments.some(r=>r.user_id===p.id),'请先完成入组及个体方案确认');
    let medicationChanged=0,taskChanged=0;
    if(b.state==='暂停用药'){
      for(const plan of db.plans)if(plan.user_id===p.id&&plan.status===0&&plan.plan_date>=effective_date){
        plan.status=3;plan.status_text='已暂停';plan.cancel_reason=reason;plan.paused_by_state=true;medicationChanged++;
      }
    }else if(b.state==='治疗中'&&priorState==='暂停用药'){
      const validTreatmentIds=new Set([
        currentTreatmentFor({db,patient:p,date:today()})?.id,
        upcomingTreatmentFor({db,patient:p,date:today()})?.id
      ].filter(Boolean).map(String));
      for(const plan of db.plans)if(plan.user_id===p.id&&plan.status===3&&plan.paused_by_state&&plan.plan_date>=effective_date&&validTreatmentIds.has(String(plan.treatment_id))){
        plan.status=0;plan.status_text='待打卡';plan.checked_at='';delete plan.cancel_reason;delete plan.paused_by_state;medicationChanged++;
      }
    }else if(['提前退出','失访'].includes(b.state)){
      for(const plan of db.plans)if(plan.user_id===p.id&&(plan.status===0||plan.paused_by_state)&&plan.plan_date>=effective_date){
        plan.status=3;plan.status_text='已取消';plan.cancel_reason=reason;delete plan.paused_by_state;medicationChanged++;
      }
      for(const task of db.followupTasks)if(task.user_id===p.id&&task.safety_followup!==true&&!['已完成','已取消'].includes(task.status)){
        task.status='已取消';task.cancel_reason=reason;taskChanged++;
      }
    }
    p.study_state=b.state;
    log(p,admin,'变更研究状态',reason,{state:priorState},{state:b.state,effective_date,medication_changed:medicationChanged,task_changed:taskChanged});
    return p;
  });
}
