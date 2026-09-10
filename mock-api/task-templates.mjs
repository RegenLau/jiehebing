export function registerTaskTemplates({core,db,assert,find,page,clean,timestamp,nextId}) {
  const types=['提醒','检查'];
  const text=(v,label,max,required=false)=>{const s=clean(v);assert(s.length<=max&&(!required||s),`请填写有效的${label}`);return s;};
  const snapshot=({history,...row})=>structuredClone(row);
  const log=(row,admin,before,reason)=>{row.history||=[];row.history.unshift({time:timestamp(),operator:admin.realname||admin.username,reason,before,after:snapshot(row)});};
  core('GET','task-template/index',({query:q})=>{
    assert(!q.type||types.includes(q.type),'任务类型不合法');assert(q.status===undefined||q.status===''||['0','1'].includes(q.status),'状态不合法');
    return page([...db.taskTemplates].reverse().filter(r=>(!q.keyword||r.name.includes(clean(q.keyword)))&&(!q.type||q.type===r.type)&&(q.status===undefined||q.status===''||r.status===Number(q.status))).map(snapshot),q);
  });
  core('GET','task-template/detail',({query:q})=>find(db.taskTemplates,q.id,'任务模板'));
  core('POST','task-template/save',({body:b,admin})=>{
    const old=b.id===undefined?null:find(db.taskTemplates,b.id,'任务模板');if(old)assert(b.version===old.version,'模板已更新，请刷新后编辑');
    assert(!old?.system_kind, '系统内置取药提醒由余药规则生成，不能编辑');
    const name=text(b.name,'模板名称',100,true),description=text(b.description,'说明',1000),requirements=text(b.requirements,'提交要求',1000,true),reason=text(b.reason,'修改原因',300,Boolean(old));
    assert(name !== '取药提醒', '取药提醒为系统内置规则，请在分组中设置提前提醒天数');
    assert(types.includes(b.type),'请选择任务类型');assert(!db.taskTemplates.some(r=>r!==old&&r.name.toLowerCase()===name.toLowerCase()),'模板名称已存在');
    const row=old||{id:nextId(db.taskTemplates),status:1},before=old?snapshot(old):null;
    Object.assign(row,{name,type:b.type,description,requirements,revision:(old?.revision||0)+1,updated_at:timestamp()});row.version=`V${row.revision}`;log(row,admin,before,reason||'新增任务模板');if(!old)db.taskTemplates.push(row);return row;
  });
  core('POST','task-template/status',({body:b,admin})=>{const row=find(db.taskTemplates,b.id,'任务模板');assert(!row.system_kind,'系统内置取药提醒不能停用');assert(b.version===row.version,'模板已更新，请刷新后操作');assert([0,1].includes(b.status)&&b.status!==row.status,'请选择不同的有效状态');const reason=text(b.reason,'变更原因',300,true),before=snapshot(row);row.status=b.status;row.revision=(row.revision||1)+1;row.version=`V${row.revision}`;row.updated_at=timestamp();log(row,admin,before,reason);return row;});
}
