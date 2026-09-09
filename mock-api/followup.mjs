export function registerFollowup({core,db,assert,find,page,clean,isDate,timestamp,nextId,today,shiftDate}) {
  db.followupTasks=[];
  const types=['检查','复诊','取药','报告提交','问卷','其他'];
  const states=['待完成','已提交','需补充','已完成','已取消'];
  const log=(r,admin,action,reason,before)=>{r.history||=[];r.history.unshift({time:timestamp(),operator:admin.realname||admin.username,action,reason,before,after:{date:r.date,due_date:r.due_date,status:r.status,result:r.result||''}});};
  const checkDate=(v)=>{assert(isDate(v),'请填写有效日期');return v;};
  const required=(v)=>{const s=clean(v);assert(s&&s.length<=1000,'请填写说明（最多1000字）');return s;};
  core('GET','followup/index',({query:q})=>page([...db.followupTasks].reverse().filter(r=>(!q.user_id||r.user_id===Number(q.user_id))&&(!q.keyword||`${r.name} ${r.patient_name}`.includes(clean(q.keyword)))&&(!q.type||r.type===q.type)&&(!q.status||r.status===q.status)&&(!q.date||r.date===q.date)&&(q.overdue!=='1'||r.due_date<today()&&!['已完成','已取消'].includes(r.status))).map(r=>({...r,overdue:r.due_date<today()&&!['已完成','已取消'].includes(r.status)})),q));
  core('GET','followup/detail',({query:q})=>find(db.followupTasks,q.id,'任务'));
  core('POST','followup/create',({body:b,admin})=>{const p=find(db.patients,b.user_id,'患者');assert(types.includes(b.type),'任务类型不合法');const date=checkDate(b.date),due_date=checkDate(b.due_date);assert(date<=due_date,'截止日期不能早于开始日期');const name=required(b.name),description=required(b.description);const row={id:nextId(db.followupTasks),user_id:p.id,patient_name:p.name,project_id:p.project_id||null,group_id:p.group_id||null,name,type:b.type,date,due_date,description,status:'待完成',source:'人工新增',history:[],created_at:timestamp()};db.followupTasks.push(row);log(row,admin,'新增任务',description,{});return row;});
  core('POST','followup/update',({body:b,admin})=>{const row=find(db.followupTasks,b.id,'任务');assert(!['已完成','已取消'].includes(row.status),'已结束任务不可修改');const reason=required(b.reason),before={date:row.date,due_date:row.due_date,status:row.status};if(b.action==='reschedule'){const date=checkDate(b.date),due_date=checkDate(b.due_date);assert(date<=due_date,'截止日期不能早于开始日期');Object.assign(row,{date,due_date});}else if(b.action==='cancel')row.status='已取消';else if(b.action==='complete'){assert(!['检查','报告提交'].includes(row.type),'检查和报告提交须通过关联报告核对后完成');row.status='已完成';row.result=reason;}else if(b.action==='supplement'){row.status='需补充';row.result=reason;}else assert(b.action==='contact','操作不支持');log(row,admin,b.action==='contact'?'人工联系':b.action==='reschedule'?'调整日期':b.action==='cancel'?'取消':b.action==='complete'?'人工确认完成':'要求补充',reason,before);return row;});
}

export function generateExecution({db,patient,treatment,group,nextId,shiftDate,timestamp}) {
  for(const plan of db.plans)if(plan.user_id===patient.id&&plan.status===0&&plan.plan_date>=treatment.start_date){plan.status=3;plan.status_text='已取消';plan.cancel_reason='个体方案更新';}
  let planId=nextId(db.plans);
  for(const d of treatment.drugs){const source=db.commonMedicines.find(m=>m.id===d.drug_id);const medicine={...source,id:nextId(db.medicines),user_id:patient.id,name:d.name,common_medicine_id:d.drug_id,source:'manual',source_text:'医生确认',medicine_count:'0',dosage:`${d.dose}${d.unit}/次`,dosage_value:String(d.dose),dosage_unit:d.unit,frequency:d.times.length,usage:'口服',treatment_id:treatment.id,created_at:timestamp()};db.medicines.push(medicine);
    for(let day=0;day<treatment.treatment_days;day++)for(const time of d.times)db.plans.push({...medicine,id:planId++,medicine_id:medicine.id,patient_name:patient.name,patient_mobile:patient.mobile,project_id:group.project_id,group_id:group.id,plan_date:shiftDate(treatment.start_date,day),plan_time:time,plan_index:d.times.indexOf(time)+1,day_number:day+1,status:0,status_text:'待打卡',checked_at:''});
  }
  for(const [key,type]of[['surveys','问卷'],['tasks',null]])for(const binding of group[key]){
    const anchor=binding.anchor==='date'?binding.date:binding.anchor==='treatment'?treatment.start_date:patient.enroll_date;
    let date=shiftDate(anchor,binding.offset_days);let iterations=0;
    while(date<=treatment.end_date&&iterations++<4000){
      if(date>=treatment.start_date&&!db.followupTasks.some(t=>t.user_id===patient.id&&t.binding_kind===key&&t.binding_id===binding.id&&t.date===date))db.followupTasks.push({id:nextId(db.followupTasks),user_id:patient.id,patient_name:patient.name,project_id:group.project_id,group_id:group.id,treatment_id:treatment.id,binding_kind:key,binding_id:binding.id,snapshot:structuredClone(binding),name:binding.snapshot.name,type:type||binding.snapshot.type,date,due_date:shiftDate(date,binding.deadline_days-1),description:binding.snapshot.requirements||binding.snapshot.description||'',status:'待完成',source:'分组安排',history:[],created_at:timestamp()});
      if(!binding.interval_days)break;date=shiftDate(date,binding.interval_days);
    }
  }
}
