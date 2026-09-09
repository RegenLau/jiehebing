export function registerResearchExport({core,db,assert,clean,today,spreadsheet}) {
 core('GET','research/export',({query:q,res})=>{
  let headers,rows;const keyword=clean(q.keyword),user_id=Number(q.user_id)||0;
  if(q.kind==='patients'){headers=['患者编号','姓名','手机号','医院','科室','研究分组','研究状态','入组基准日'];rows=db.patients.filter(p=>(!keyword||`${p.name} ${p.mobile} ${p.patient_code||''}`.includes(keyword))&&(!q.study_state||(p.study_state||'待启用')===q.study_state)).map(p=>[p.patient_code||p.id,p.name,p.mobile,p.hospital_name,p.department_name,p.group_name||'',p.study_state||'待启用',p.enroll_date]);}
  else if(q.kind==='tasks'){headers=['任务ID','患者','任务','类型','开始日期','截止日期','状态','来源','说明','结果'];rows=db.followupTasks.filter(r=>(!user_id||r.user_id===user_id)&&(!keyword||`${r.name} ${r.patient_name}`.includes(keyword))&&(!q.type||r.type===q.type)&&(!q.status||r.status===q.status)&&(q.overdue!=='1'||r.due_date<today()&&!['已完成','已取消'].includes(r.status))).map(r=>[r.id,r.patient_name,r.name,r.type,r.date,r.due_date,r.status,r.source,r.description,r.result||'']);}
  else if(q.kind==='reports'){headers=['报告ID','患者','类型','检查日期','关联任务','状态','上传次数','核对指标'];rows=db.reports.filter(r=>(!user_id||r.user_id===user_id)&&(!keyword||`${r.patient_name} ${r.type}`.includes(keyword))&&(!q.status||r.status===q.status)).map(r=>[r.id,r.patient_name,r.type,r.exam_date,r.task_id||'',r.status,r.versions.length,r.metrics.map(m=>`${m.name}：${m.value}${m.unit}（${m.reference}）`).join('；')]);}
  else if(q.kind==='feedback'){headers=['患者','日期','症状变化','补充说明','来源'];rows=db.feedback.filter(r=>(!user_id||r.user_id===user_id)&&(!keyword||r.patient_name.includes(keyword))&&(!q.date||r.date===q.date)).map(r=>[r.patient_name,r.date,r.no_discomfort?'无不适':r.symptoms.map(s=>`${s.name}：${s.change}`).join('；'),r.note,r.source]);}
  else assert(false,'导出类型不支持');
  spreadsheet(res,`${q.kind}_mock.xlsx`,headers,rows);
 });
}
