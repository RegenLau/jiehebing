import { normalizeGroupDrugs, registerPrescriptionRecognition } from './group-medication.mjs';
import { DEFAULT_PICKUP_REMIND_TIME, DEFAULT_PICKUP_REQUIREMENTS } from './pickup-reminder.mjs';
import { effectiveProjectStatus, projectStatusView } from './project-status.mjs';
// Project configuration is independent from patient treatment and generated tasks.
export function registerProjects({ core, db, assert, find, page, clean, isDate, timestamp, nextId, today }) {
  registerPrescriptionRecognition({core, db, assert, clean});
  const copy = value => structuredClone(value);
  const number = (value, label, min = 0, max = 3650) => {
    assert(typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max, `${label}应为${min}至${max}的整数`);
    return value;
  };
  const text = (value, label, max, required = false) => {
    const result = clean(value); assert(result.length <= max && (!required || result), `请填写${required ? '有效的' : ''}${label}（最多${max}字）`); return result;
  };
  const project = id => find(db.projects, id, '项目');
  const view = record => projectStatusView(record, today());
  const writableProject = record => {
    assert(effectiveProjectStatus(record, today()) !== 2, '项目已结束，仅支持查看，不能修改');
    return record;
  };
  const group = (projectId, id) => { const row = find(db.projectGroups, id, '分组'); assert(row.project_id === project(projectId).id, '分组不属于当前项目', 404); return row; };
  const groupView = row => {
    const fallbackTime = row.reminder?.snapshot?.task_remind_time || '09:00';
    const scheduleView = item => ({
      ...copy(item),
      remind_time: /^([01]\d|2[0-3]):[0-5]\d$/.test(item.remind_time) ? item.remind_time : fallbackTime
    });
    return {
      ...copy(row),
      pickup_requirements: row.pickup_requirements || DEFAULT_PICKUP_REQUIREMENTS,
      pickup_remind_time: row.pickup_remind_time || row.reminder?.snapshot?.pickup_remind_time || DEFAULT_PICKUP_REMIND_TIME,
      surveys: (row.surveys || []).map(scheduleView),
      tasks: (row.tasks || []).map(scheduleView),
      can_delete: effectiveProjectStatus(project(row.project_id), today()) !== 2 && !(row.participant_ids || []).length && !db.patients.some(patient => patient.group_id === row.id),
      participants: (row.participant_ids || []).map(id => {
        const patient = find(db.patients,id,'患者');
        return {
          id:patient.id,
          patient_code:patient.patient_code || '',
          name:patient.name,
          mobile:patient.mobile,
          gender_text:patient.gender_text || '',
          birth_date:patient.birth_date || '',
          enroll_date:patient.enroll_date || '',
          study_state:patient.study_state || '待启用'
        };
      })
    };
  };
  const log = (p, admin, action, note, before, after) => {
    p.updated_at = timestamp();
    const changes = Object.keys(after).filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k])).map(field => ({ field, before: before[field] ?? '', after: after[field] }));
    p.history.unshift({ action, operator: admin.realname || admin.username, time: timestamp(), note, changes });
  };
  core('GET', 'project/index', ({ query: q }) => {
    assert(q.status === undefined || q.status === '' || ['0', '1', '2'].includes(q.status), '项目状态不合法');
    const keyword = clean(q.keyword).toLowerCase();
    const rows = db.projects.filter(p => (!keyword || `${p.code} ${p.name}`.toLowerCase().includes(keyword)) && (q.status === undefined || q.status === '' || effectiveProjectStatus(p, today()) === Number(q.status)));
    return page([...rows].sort((a,b) => b.id-a.id).map(({ history, ...p }) => {
      const groups = db.projectGroups.filter(g => g.project_id === p.id);
      const patientIds = new Set(db.patients.filter(patient => patient.project_id === p.id).map(patient => patient.id));
      for (const group of groups) for (const id of group.participant_ids || []) patientIds.add(id);
      return { ...view(p), group_count: groups.length, patient_count: patientIds.size, can_delete: effectiveProjectStatus(p, today()) !== 2 && groups.length === 0 && patientIds.size === 0 };
    }), q);
  });
  core('GET', 'project/detail', ({ query: q }) => ({ ...view(project(q.id)), groups: db.projectGroups.filter(g => g.project_id === Number(q.id)).map(groupView) }));
  core('POST', 'project/save', ({ body: b, admin }) => {
    const existing = b.id === undefined ? null : writableProject(project(b.id));
    assert(b.status === undefined, '项目状态由研究周期和手动结束决定');
    const data = { code: text(b.code,'项目编号',40,true), name: text(b.name,'项目名称',100,true), purpose: text(b.purpose,'研究目的',1000), start_date: clean(b.start_date), end_date: clean(b.end_date) };
    assert(/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(data.code), '项目编号仅支持字母、数字、短横线和下划线');
    assert(!db.projects.some(p => p !== existing && p.code.toLowerCase() === data.code.toLowerCase()), '项目编号已存在');
    assert(isDate(data.start_date) && isDate(data.end_date) && data.start_date <= data.end_date, '请填写有效且顺序正确的研究周期');
    const record = existing || { id: nextId(db.projects), status: 0, created_at: timestamp(), history: [] };
    const before = copy(record);
    if (existing && Object.keys(data).every(k => data[k] === existing[k])) return view(record);
    Object.assign(record, data);
    log(record, admin, existing ? '编辑' : '新建', existing ? '更新项目资料' : '创建研究项目', before, data);
    if (!existing) db.projects.push(record);
    return view(record);
  });
  core('POST', 'project/change-status', ({ body: b, admin }) => {
    const record = project(b.id);
    const target = number(b.status, '状态', 0, 2);
    assert(target === 2, '项目状态只能手动结束');
    const current = effectiveProjectStatus(record, today());
    assert(current !== 2, '项目已结束，无需重复操作');
    if (b.expected_status !== undefined) assert(b.expected_status === current, '项目状态已变化，请刷新后重试');
    const reason = text(b.reason, '状态变更原因', 300, true);
    const before = { status: current, status_source: 'date', manual_ended_at: '' };
    record.status = 2;
    record.manual_ended_at = timestamp();
    record.manual_end_reason = reason;
    log(record, admin, '手动结束', reason, before, { status: 2, status_source: 'manual', manual_ended_at: record.manual_ended_at });
    return view(record);
  });
  core('POST', 'project/delete', ({ body: b }) => {
    const record = writableProject(project(b.id));
    assert(!db.projectGroups.some(group => group.project_id === record.id), '项目下仍有分组，请先删除空分组');
    assert(!db.patients.some(patient => patient.project_id === record.id), '项目下仍有关联患者，不能删除');
    db.projects.splice(db.projects.indexOf(record), 1);
    return { id: record.id, name: record.name };
  });
  core('GET', 'project/catalog', () => ({
    medication_schemes: db.medicationSchemes,
    task_templates: db.taskTemplates.filter(template => template.system_kind !== 'pickup'),
    reminder_schemes: db.reminderSchemes,
    surveys: db.surveys.map(s => ({ id: s.id, name: s.name, description: s.description, status: s.status, version: s.updatedAt, questions: s.questions })),
  }));
  core('GET', 'project/participants', ({ query: q }) => {
    const p = project(q.project_id);
    return db.patients.map(patient => {
      const assigned = db.projectGroups.find(g => g.project_id === p.id && g.participant_ids?.includes(patient.id));
      return { id: patient.id, name: patient.name, mobile: patient.mobile, is_archived: patient.is_archived, group_id: assigned?.id ?? null, group_name: assigned?.name ?? '' };
    });
  });
  core('POST', 'project/group-create', ({ body: b, admin }) => {
    const p = writableProject(project(b.project_id));
    assert(Object.keys(b).every(k => ['project_id','name','description'].includes(k)), '创建分组只需基础信息，请创建后再设置方案和任务');
    const name = text(b.name,'分组名称',60,true), description = text(b.description,'分组说明',1000);
    assert(!db.projectGroups.some(g => g.project_id === p.id && g.name.toLowerCase() === name.toLowerCase()), '当前项目已有同名分组');
    const record = { id:nextId(db.projectGroups), project_id:p.id, name, description, pickup_requirements:DEFAULT_PICKUP_REQUIREMENTS, pickup_remind_time:DEFAULT_PICKUP_REMIND_TIME, revision:1, medication:null, reminder:null, surveys:[],tasks:[],participant_ids:[],participants:[],created_at:timestamp(),updated_at:timestamp() };
    db.projectGroups.push(record);
    log(p,admin,'新增分组',name, {group:{}}, {group:copy(record)});
    return groupView(record);
  });
  core('GET', 'project/group-detail', ({ query: q }) => groupView(group(q.project_id, q.id)));
  core('POST', 'project/group-basic-save', ({ body: b, admin }) => {
    const p = writableProject(project(b.project_id));
    assert(Object.keys(b).every(k => ['id','project_id','revision','name','description'].includes(k)), '编辑分组只允许修改分组名称和分组说明');
    const existing = group(p.id,b.id);
    assert(b.revision === existing.revision, '分组已更新，请重新打开后编辑');
    const name = text(b.name,'分组名称',60,true), description = text(b.description,'分组说明',1000);
    assert(!db.projectGroups.some(g => g.project_id === p.id && g !== existing && g.name.toLowerCase() === name.toLowerCase()), '当前项目已有同名分组');
    if (existing.name === name && existing.description === description) return groupView(existing);
    const before = copy(existing);
    Object.assign(existing,{name,description,revision:existing.revision+1,updated_at:timestamp()});
    log(p,admin,'编辑分组基础信息',name,{group:before},{group:copy(existing)});
    return groupView(existing);
  });
  core('POST', 'project/group-delete', ({ body: b, admin }) => {
    const p = writableProject(project(b.project_id));
    const record = group(p.id,b.id);
    assert(!(record.participant_ids || []).length && !db.patients.some(patient => patient.group_id === record.id), '分组内仍有患者，不能删除');
    const before = copy(record);
    db.projectGroups.splice(db.projectGroups.indexOf(record), 1);
    log(p,admin,'删除空分组',record.name,{group:before},{group:null});
    return { id: record.id, name: record.name };
  });
  core('POST', 'project/group-save', ({ body: b, admin }) => {
    const p = writableProject(project(b.project_id));
    assert(b.id !== undefined, '请先创建分组基础信息');
    const existing = group(p.id, b.id);
    if (existing) assert(b.revision === existing.revision, '分组配置已更新，请重新打开后编辑');
    const name = text(b.name,'分组名称',60,true);
    assert(!db.projectGroups.some(g => g.project_id === p.id && g !== existing && g.name.toLowerCase() === name.toLowerCase()), '当前项目已有同名分组');
    const description = text(b.description,'分组说明',1000);
    const pickup_requirements = text(b.pickup_requirements ?? existing?.pickup_requirements ?? DEFAULT_PICKUP_REQUIREMENTS,'取药提醒要求说明',1000,true);
    const pickup_remind_time = clean(b.pickup_remind_time || existing?.pickup_remind_time || existing?.reminder?.snapshot?.pickup_remind_time || DEFAULT_PICKUP_REMIND_TIME);
    assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(pickup_remind_time), '请填写有效的取药提醒时间');
    const binding = (rows, id, label, old) => {
      number(id,`${label}编号`,1,99999999);
      const source = find(rows,id,label);
      assert(source.status === 1 || old?.id === id, `${label}已停用，不能新增关联`);
      return old?.id === id ? copy(old) : { id, snapshot: copy(source) };
    };
    const array = (values,label,max=30) => { assert(Array.isArray(values) && values.length <= max, `${label}必须为列表，最多${max}项`); return values; };
    const unique = (values,label) => { assert(new Set(values).size === values.length, `${label}不能重复关联`); };
    let medication = null;
    if (b.medication !== null && b.medication !== undefined) {
      const m = b.medication;
      const source = m.id === 0
        ? {id:0,snapshot:{id:0,name:`${name}用药方案`,status:1,drugs:[]}}
        : binding(db.medicationSchemes,m.id,'用药方案',existing?.medication);
      if (m.drugs !== undefined) {
        source.snapshot.drugs = normalizeGroupDrugs(m.drugs, {db,assert,find,clean}, existing?.medication?.snapshot.drugs, false);
      }
      assert(source.snapshot.drugs?.length, '请添加并确认分组药品');
      const days = number(m.treatment_days,'治疗天数',1);
      assert(m.pickup_mode === undefined || ['manual','quantity'].includes(m.pickup_mode), '取药周期计算方式不合法');
      if (m.pickup_mode === 'quantity') assert(m.drugs !== undefined, '按药量计算取药周期时请提交完整药品卡片');
      const cycle = m.pickup_mode === 'quantity'
        ? Math.min(days, Math.max(1, Math.floor(Math.min(...source.snapshot.drugs.map(d => d.quantity / (Number(d.dose) * d.daily_count))))))
        : number(m.pickup_days,'取药周期',1);
      const advance = number(m.advance_days,'提前提醒天数',0,60);
      const quantities = array(m.quantities,'首次发药',100);
      const drugs = source.snapshot.drugs;
      unique(quantities.map(q=>q.drug_id),'发药药品');
      assert(quantities.length === drugs.length, '请填写方案中每种药品的首次发药数量');
      const amounts = quantities.map(q => { assert(drugs.some(d=>d.drug_id === q.drug_id), '发药药品不属于当前方案'); return { drug_id:q.drug_id, quantity:number(q.quantity,'首次发药数量',1,100000) }; });
      if (m.drugs !== undefined) assert(amounts.every(q=>q.quantity===drugs.find(d=>d.drug_id===q.drug_id).quantity), '首次发药量应与药品卡片的药品量一致');
      const prescription_url = clean(m.prescription_url);
      if (prescription_url) assert(/^\/api\/mock-files\/[\w-]+$/.test(prescription_url) && db.files.get(prescription_url.split('/').at(-1))?.type.startsWith('image/'), '处方图片已失效，请重新上传');
      medication = { ...source, treatment_days:days, pickup_days:cycle, advance_days:advance, quantities:amounts,
        ...(m.drugs !== undefined ? {drugs:copy(source.snapshot.drugs)} : {}), ...(m.pickup_mode ? {pickup_mode:m.pickup_mode} : {}), ...(prescription_url ? {prescription_url} : {}) };
    }
    let reminder = null;
    if (b.reminder !== null && b.reminder !== undefined) {
      reminder = binding(db.reminderSchemes,b.reminder.id,'提醒方案',existing?.reminder);
    }
    const schedules = (items, kind, rows) => {
      array(items,kind); unique(items.map(r=>r.id),kind);
      return items.map(item => {
        const old = existing?.[kind]?.find(r=>r.id === item.id);
        const source = binding(rows,item.id,kind === 'surveys' ? '问卷' : '任务模板',old);
        if (kind === 'tasks') assert(source.snapshot.system_kind !== 'pickup', '取药提醒由系统按患者实际药量计算，只需设置提前提醒天数');
        assert(['enrollment','treatment','date'].includes(item.anchor),'请选择有效的计时基准');
        const offset_days = number(item.offset_days,'第一次执行天数');
        const interval_days = number(item.interval_days,'执行频率天数');
        const deadline_days = number(item.deadline_days,'完成期限',1);
        const date = item.anchor === 'date' ? clean(item.date) : '';
        if (item.anchor === 'date') assert(isDate(date) && interval_days === 0 && offset_days === 0, '指定日期任务必须设置有效日期，偏移和重复间隔为0');
        const fallbackTime = old?.remind_time || existing?.reminder?.snapshot?.task_remind_time || '09:00';
        const remind_time = clean(item.remind_time || fallbackTime);
        assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(remind_time), '请填写有效的提醒时间');
        return { ...source, anchor:item.anchor, date, offset_days, interval_days, deadline_days, remind_time };
      });
    };
    const surveys = schedules(b.surveys,'surveys',db.surveys);
    const tasks = schedules(b.tasks,'tasks',db.taskTemplates);
    assert(!b.article_ids?.length && !b.contact_ids?.length, '分组不再配置科普或通知账号');
    const participant_ids = array(b.participant_ids,'患者',10000).map(id => {
      number(id,'患者编号',1,99999999);
      const patient = find(db.patients,id,'患者');
      assert(patient.is_archived === 1 || existing.participant_ids?.includes(id), '只能添加已建档患者');
      const assigned = db.projectGroups.find(g => g !== existing && g.project_id === p.id && g.participant_ids?.includes(id));
      assert(!assigned, `患者已属于本项目其他分组，请先在原组移除后再添加`);
      return id;
    });
    unique(participant_ids,'患者');
    const participants = participant_ids.map(id => { const p = find(db.patients,id,'患者'); return {id:p.id,name:p.name,mobile:p.mobile}; });
    const data = { name, description, pickup_requirements, pickup_remind_time, medication, reminder, surveys, tasks, participant_ids, participants };
    const record = existing || { id:nextId(db.projectGroups), project_id:p.id, revision:0, created_at:timestamp() };
    const before = existing ? copy(existing) : {};
    Object.assign(record,data,{revision:record.revision+1,updated_at:timestamp()});
    if (!existing) db.projectGroups.push(record);
    log(p,admin,existing ? '编辑分组' : '新增分组',`${name}（配置第${record.revision}版）`, { group:before }, { group:copy(record) });
    return groupView(record);
  });
}
