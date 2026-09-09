export function shanghaiDate(value) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

export function shiftDate(date, offset) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function ageOnDate(birthDate, date) {
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
  const [year, month, day] = date.split('-').map(Number);
  return year - birthYear - (month < birthMonth || month === birthMonth && day < birthDay ? 1 : 0);
}

export function createFixtures(now) {
  const today = shanghaiDate(now);
  const time = `${today} 09:00:00`;
  const projects = [0, 1, 2].map((status, i) => ({
    id: i + 1, code: `TB-DEMO-00${i + 1}`, name: ['结核病院外随访研究（筹备示例）', '结核病规范用药随访研究（演示）', '结核病随访试点（结束示例）'][i],
    center: '模拟医院 · 结核病研究中心', investigator: '演示研究者', phone: '010-00000000',
    start_date: shiftDate(today, status === 0 ? 7 : -90), end_date: shiftDate(today, status === 2 ? -1 : 180),
    protocol_version: 'V1.0', effective_date: shiftDate(today, -100), purpose: '用于演示研究项目信息维护，不对应真实临床研究。', notes: '',
    research_type: ['open', 'single_blind', 'double_blind'][i], status, created_at: time, updated_at: time, history: [{ action: '初始化', operator: '模拟系统', time, note: '演示项目数据' }]
  }));
  const patientProfiles = [
    ['模拟患者·林安然', '13910001001', 2, '1988-03-12'], ['模拟患者·周明远', '13910001002', 1, '1979-11-26'],
    ['模拟患者·陈嘉禾', '13910001003', 1, '1992-07-08'], ['模拟患者·赵清妍', '13910001004', 2, '1985-01-19'],
    ['模拟患者·孙景行', '13910001005', 1, '1971-09-03'], ['模拟患者·吴念慈', '13910001006', 2, '1996-05-22'],
    ['模拟患者·郑云帆', '13910001007', 1, '1982-12-14'], ['模拟患者·王舒宁', '13910001008', 2, '1990-04-30'],
    ['模拟患者·冯知远', '13910001009', 1, '1968-08-17'], ['模拟患者·褚静宜', '13910001010', 2, '1976-02-09'],
    ['模拟患者·卫向晨', '13910001011', 1, '1998-10-05'], ['模拟患者·蒋若溪', '13910001012', 2, '1987-06-28'],
    ['模拟患者·沈致远', '13910001013', 1, '1974-03-16'], ['模拟患者·韩书瑶', '13910001014', 2, '1994-09-21'],
    ['模拟患者·杨修文', '13910001015', 1, '1980-01-07'], ['模拟患者·朱清和', '13910001016', 2, '1965-11-11'],
    ['模拟患者·秦望舒', '13910001017', 2, '1999-07-24'], ['模拟患者·许承安', '13910001018', 1, '1983-05-13'],
    ['模拟患者·何雨晴', '13910001019', 2, '1978-12-02'], ['模拟患者·吕知行', '13910001020', 1, '1991-08-09'],
    ['模拟患者·施婉宁', '13910001021', 2, '1986-04-18'], ['模拟患者·张怀瑾', '13910001022', 1, '1970-10-27'],
    ['模拟患者·孔思齐', '13910001023', 1, '1995-02-15'], ['模拟患者·曹静姝', '13910001024', 2, '1981-06-06'],
    ['模拟患者·严嘉树', '13910001025', 1, '1989-09-12'], ['模拟患者·华安琪', '13910001026', 2, '1973-01-25'],
    ['模拟患者·金予安', '13910001027', 1, '1997-11-08'], ['模拟患者·魏清越', '13910001028', 2, '1984-05-31']
  ];
  const patients = patientProfiles.map(([name, mobile, gender, birth_date], i) => {
    const offset = i < 12 ? -(40 + i) : i < 16 ? -(i - 11) : -(i + 3);
    const enroll_date = shiftDate(today, offset);
    return {
      id: i + 1, patient_code: `TB-MOCK-${String(i + 1).padStart(3, '0')}`, name, mobile, gender,
      gender_text: gender === 1 ? '男' : '女', birth_date, age: ageOnDate(birth_date, today),
      is_archived: 1, login_enabled: true, created_via: 'admin', study_state: '待启用',
      enroll_date, offline_confirmed: true, consent_confirmed: true,
      identity_confirmed: false, medicine_confirmed: false, status: 1,
      created_at: `${enroll_date} 06:00:00`, updated_at: time
    };
  });
  const drugNames = ['异烟肼片', '利福平胶囊', '吡嗪酰胺片', '盐酸乙胺丁醇片'];
  const commonMedicines = Array.from({ length: 16 }, (_, i) => ({
    id: i + 1, common_name: drugNames[i % 4], company: `模拟药业${i % 4 + 1}`, specification: '演示规格',
    ybm: `MOCK-DRUG-${String(i + 1).padStart(3, '0')}`, usage: '口服（演示）', frequency: 1,
    dosage: '遵医嘱（模拟）', dosage_value: '1', dosage_unit: '片', medication_guidance: '模拟资料，仅用于展示界面；具体用药请遵医嘱。',
    thumb: '/api/mock-files/medicine-cover', sort_order: i, status: i % 5 ? 1 : 0,
    status_text: i % 5 ? '启用' : '停用', created_at: `${shiftDate(today, -60)} 06:00:00`, updated_at: time
  }));
  const medicines = patients.filter(p => p.id <= 24).flatMap((p, i) => [0, 1].map((n) => {
    const m = commonMedicines[(i + n) % 16];
    return { ...m, id: i * 2 + n + 1, user_id: p.id, name: m.common_name, remark: '模拟用药记录', trade_name: '模拟药品',
      medicine_count: '30', batch_no: `MOCK-${p.id}-01`, sort: n, source: n ? 'manual' : 'ocr', source_text: n ? '手动添加' : '识别导入', created_at: `${p.enroll_date} 07:00:00` };
  }));
  let nextPlan = 1;
  const plans = [];
  for (let day = -35; day <= 3; day++) {
    for (const m of medicines) {
      const p = patients.find(p => p.id === m.user_id);
      if (shiftDate(today, day) < m.created_at.slice(0, 10)) continue;
      const status = day > 0 ? 0 : (m.id + day + 100) % 5 === 0 ? 0 : 1;
      const plan_date = shiftDate(today, day);
      plans.push({ ...m, id: nextPlan++, medicine_id: m.id, patient_name: p.name, patient_mobile: p.mobile,
        plan_date, day_number: Math.round((Date.parse(plan_date) - Date.parse(m.created_at.slice(0, 10))) / 86400000) + 1, plan_time: '08:00', plan_index: 1, status,
        status_text: status ? '已打卡' : '待打卡', checked_at: status ? `${plan_date} 08:05:00` : '', created_at: m.created_at });
    }
  }
  const adverse = Array.from({ length: 36 }, (_, i) => {
    const p = patients[i % 24];
    const severity = i % 3 + 1;
    const symptoms = [['头晕'], ['恶心', '食欲下降'], ['皮疹']][i % 3];
    const proposedDate = shiftDate(today, -(i % 30));
    const occurred_at = `${proposedDate < p.enroll_date ? p.enroll_date : proposedDate} 10:30:00`;
    return { id: i + 1, user_id: p.id, patient_name: p.name, patient_mobile: p.mobile, occurred_at,
      symptoms, symptom_summary: symptoms.join('、'), symptom_description: '模拟症状记录，用于功能演示。', severity,
      severity_text: ['轻度', '中度', '重度'][severity - 1], advice_text: '模拟处理建议，请联系医生评估。',
      status: i % 4 === 0 ? 2 : 1, status_text: i % 4 === 0 ? '已处理' : '已上报', created_at: occurred_at };
  });
  const titleList = ['您最近有无新增或减少药物？', '您最近服用药物的剂量和频次是否有变化？', '您最近有没有到医院复查？', '服药以后有没有出现不舒服（如头晕、皮疹、恶心等）？', '最近 2 周内，有没有以下情况？（可多选）', '您最想问药师或医生的用药问题是：'];
  const questions = titleList.map((title, i) => ({
    id: i + 1, questionNo: i + 1, title, type: i === 5 ? 'TEXT' : i === 4 ? 'CHECKBOX' : 'RADIO',
    required: i === 5 ? 0 : 1, sortOrder: i + 1, placeholder: i === 5 ? '请输入您的问题' : '',
    options: i === 5 ? [] : (i === 4 ? ['忘记吃药', '自己减量或停药', '自行增加剂量', '以上都没有'] : ['没有', '有，请补充说明']).map((label, j) => ({
      id: (i + 1) * 10 + j + 1, label, sortOrder: j + 1, isExclusive: i === 4 && j === 3,
      triggerInput: i < 4 && j === 1,
      inputFields: i < 4 && j === 1 ? [{ field_key: `detail_${i + 1}`, field_label: '补充说明', field_type: 'text', required: true, placeholder: '请输入说明' }] : null
    }))
  }));
  const surveys = [
    { id: 1, code: 'TB_FOLLOWUP_V1', name: '结核病随访问卷', description: '模拟问卷，用于演示随访管理。', fillableDay: 7, status: 1, createdAt: `${shiftDate(today, -60)} 06:00:00`, updatedAt: `${shiftDate(today, -60)} 06:00:00`, questions },
    { id: 2, code: 'MOCK_DRAFT', name: '模拟随访草稿', description: '暂无作答，可编辑或删除。', fillableDay: 30, status: 0, createdAt: time, updatedAt: time,
      questions: [{ id: 7, questionNo: 1, title: '请填写本次随访备注', type: 'TEXT', required: 0, sortOrder: 1, placeholder: '请输入备注', options: [] }] }
  ];
  const answers = patients.filter(p => p.id >= 5 && p.id <= 12).map(p => ({ user_id: p.id, template_id: 1, submitted_at: `${[shiftDate(today, -1), shiftDate(p.enroll_date, surveys[0].fillableDay)].sort().at(-1)} 14:00:00`,
    values: questions.map(q => ({ question_id: q.id, option_ids: q.type === 'TEXT' ? [] : [q.options[q.type === 'CHECKBOX' ? 3 : p.id % 2].id], text_value: q.type === 'TEXT' ? '模拟答卷：希望了解复查安排。' : '', extra_inputs: { [`detail_${q.id}`]: '模拟补充说明' } })) }));
  const articles = Array.from({ length: 13 }, (_, i) => ({
    id: i + 1, title: ['规范用药与随访', '复查前的准备', '健康生活小贴士'][i % 3] + `（演示${i + 1}）`, cover: '/api/mock-files/article-cover',
    summary: '模拟健康文章摘要，用于展示列表和详情。', content: '<h2>模拟健康科普</h2><p>请按医生安排完成随访与复查。此为演示内容。</p>',
    view_count: 30 + i * 7, sort: i, status: i % 4 ? 1 : 0, published_at: `${shiftDate(today, -i)} 09:00:00`, created_at: `${shiftDate(today, -i)} 09:00:00`, updated_at: time
  }));
  const admins = [{ id: 1, username: 'admin', password: 'Mock123456', realname: '演示管理员', gender: '1', email: 'admin@example.invalid', phone: '13800000000', avatar: '/api/mock-files/admin-avatar', status: 1, created_at: time, updated_at: time }];
  const files = new Map();
  for (const [id, title, color] of [['article-cover', '随访健康科普 · 模拟', '#2b76b7'], ['medicine-cover', '模拟药品', '#269b88'], ['admin-avatar', '演示', '#557cc4']]) {
    const buffer = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" rx="24" fill="${color}"/><text x="320" y="190" text-anchor="middle" font-size="36" fill="white">${title}</text></svg>`);
    files.set(id, { buffer, type: 'image/svg+xml', name: `${id}.svg`, created_at: time });
  }
  const medicationSchemes = [1, 2, 3].map((id) => ({
    id, name: `演示用药方案 ${id}`, description: '仅用于验证关联流程，非临床用药建议', version: 'V1.0', status: id === 3 ? 0 : 1,
    drugs: commonMedicines.filter(m => m.status === 1).slice(id - 1, id + 1).map(m => ({ drug_id: m.id, name: m.common_name, specification: m.specification, dose: m.dosage_value, unit: m.dosage_unit, frequency: '每日1次（演示）', times: '08:00', precautions: m.medication_guidance }))
  }));
  const taskTemplates = ['检查', '复诊', '取药', '报告提交'].map((type,i) => ({ id:i+1, name:`${type}模板（演示）`, type, status:1, version:'V1.0', description:`按研究安排完成${type}`, requirements: i === 0 || i === 3 ? '提交检查日期及报告原图' : '提交完成日期和补充说明' }));
  const groupDefinitions = [
    { id: 1, project_id: 1, name: '筹备标准随访组', description: '筹备阶段的标准随访流程演示组。', scheme_id: 1, task_ids: [1, 2], participant_ids: patients.slice(8, 13).map(p => p.id) },
    { id: 2, project_id: 1, name: '筹备强化随访组', description: '筹备阶段的强化提醒与复查流程演示组。', scheme_id: 2, task_ids: [1, 3], participant_ids: patients.slice(13, 18).map(p => p.id) },
    { id: 3, project_id: 2, name: '规范用药随访组', description: '用于演示规范用药、定期复查及随访问卷。', scheme_id: 1, task_ids: [1, 2], participant_ids: patients.slice(18, 23).map(p => p.id) },
    { id: 4, project_id: 2, name: '强化管理随访组', description: '用于演示加强提醒、取药和报告提交管理。', scheme_id: 2, task_ids: [1, 3, 4], participant_ids: patients.slice(23).map(p => p.id) },
    { id: 5, project_id: 3, name: '历史完成随访组', description: '用于查看已结束项目的历史分组配置。', scheme_id: 1, task_ids: [1, 2], participant_ids: patients.slice(0, 4).map(p => p.id) },
    { id: 6, project_id: 3, name: '历史重点复核组', description: '用于查看已结束项目的重点复核配置。', scheme_id: 2, task_ids: [1, 4], participant_ids: patients.slice(4, 8).map(p => p.id) }
  ];
  const schedule = (source, interval_days, offset_days = 0) => ({
    id: source.id, snapshot: structuredClone(source), anchor: 'enrollment', date: '', offset_days, interval_days, deadline_days: 3,
    reminders: { start: true, due: true, overdue: true }
  });
  const projectGroups = groupDefinitions.map(definition => {
    const scheme = medicationSchemes.find(item => item.id === definition.scheme_id);
    const participants = definition.participant_ids.map(id => {
      const patient = patients.find(item => item.id === id);
      return { id: patient.id, name: patient.name, mobile: patient.mobile };
    });
    return {
      id: definition.id, project_id: definition.project_id, name: definition.name, description: definition.description, revision: 2,
      medication: { id: scheme.id, snapshot: structuredClone(scheme), treatment_days: 180, pickup_days: 30, advance_days: 5, quantities: scheme.drugs.map(drug => ({ drug_id: drug.drug_id, quantity: 30 })) },
      surveys: [schedule(surveys[0], definition.id % 2 ? 14 : 7)],
      tasks: definition.task_ids.map((id, index) => schedule(taskTemplates.find(item => item.id === id), 30, index * 3)),
      participant_ids: definition.participant_ids, participants, created_at: time, updated_at: time
    };
  });
  for (const group of projectGroups) {
    const project = projects.find(item => item.id === group.project_id);
    for (const patientId of group.participant_ids) {
      const patient = patients.find(item => item.id === patientId);
      Object.assign(patient, { project_id: project.id, project_name: project.name, group_id: group.id, group_name: group.name, owner_id: admins[0].id, owner_name: admins[0].realname });
    }
  }
  return { projects, projectGroups, medicationSchemes, taskTemplates, patients, medicines, plans, adverse, commonMedicines, surveys, answers, articles, admins, files, loginLogs: [], operationLogs: [] };
}

export function createMenu() {
  const groups = [
    ['dashboard', 'Dashboard', 'dashboard', 'ri:dashboard-line', 'console', 'Console', '/dashboard/console', 'console'],
    ['patient', 'Patient', 'patient', 'ri:user-heart-line', 'index', 'PatientIndex', '/admin/patient', 'list'],
    ['medication-plan', 'MedicationPlan', 'medicationPlan', 'ri:capsule-line', 'index', 'MedicationPlanIndex', '/admin/medication-plan', 'list'],
    ['adverse-reaction', 'AdverseReaction', 'adverseReaction', 'ri:alarm-warning-line', 'index', 'AdverseReactionIndex', '/admin/adverse-reaction', 'list'],
    ['survey', 'Survey', 'survey', 'ri:survey-line', 'index', 'SurveyIndex', '/admin/survey', 'list'],
    ['health-article', 'HealthArticle', 'healthArticle', 'ri:book-open-line', 'index', 'HealthArticleIndex', '/admin/health-article', 'list'],
    ['common-medicine', 'CommonMedicine', 'commonMedicine', 'ri:medicine-bottle-line', 'index', 'CommonMedicineIndex', '/admin/common-medicine', 'list'],
    ['admin', 'Admin', 'admin', 'ri:admin-line', 'user', 'AdminUser', '/admin/user', 'user']
  ];
  const result = groups.map(([path, name, key, icon, childPath, childName, component, childKey]) => ({
    path: `/${path}`, name, component: '/index/index', meta: { title: `menus.${key}.title`, icon },
    children: [{ path: childPath, name: childName, component, meta: { title: `menus.${key}.${childKey}`, keepAlive: path !== 'dashboard', ...(path === 'dashboard' ? { fixedTab: true } : {}) } }]
  }));
  result[0].children.push({ path: 'user-center', name: 'UserCenter', component: '/dashboard/user-center', meta: { title: '个人中心', isHide: true, keepAlive: false } });
  result[1].children.push({ path: 'detail', name: 'PatientDetail', component: '/admin/patient-detail', meta: { title: 'menus.patient.detail', isHide: true, activePath: '/patient/index', keepAlive: false } });
  result.splice(1, 0, { path: '/project', name: 'Project', component: '/index/index', meta: { title: 'menus.project.title', icon: 'ri:folder-chart-line' },
    children: [
      { path: 'index', name: 'ProjectIndex', component: '/admin/project', meta: { title: 'menus.project.list', keepAlive: true } },
      { path: 'groups', name: 'ProjectGroups', component: '/admin/project-groups', meta: { title: '研究分组', isHide: true, activePath: '/project/index', keepAlive: false } },
      { path: 'group', name: 'ProjectGroup', component: '/admin/project-group', meta: { title: '分组配置', isHide: true, activePath: '/project/index', keepAlive: false } }
    ] });
  const medication = result.find(r => r.name === 'MedicationPlan');
  medication.meta.title = '用药管理';
  medication.children.unshift({path:'schemes',name:'MedicationSchemes',component:'/admin/medication-schemes',meta:{title:'用药方案',keepAlive:false}});
  result.splice(4,0,{path:'/followup',name:'Followup',component:'/index/index',meta:{title:'随访任务',icon:'ri:calendar-check-line'},children:[{path:'feedback',name:'FeedbackRecords',component:'/admin/feedback',meta:{title:'每日反馈记录',keepAlive:false}},{path:'index',name:'FollowupTasks',component:'/admin/followup',meta:{title:'任务列表',keepAlive:false}},{path:'templates',name:'TaskTemplates',component:'/admin/task-templates',meta:{title:'任务模板',keepAlive:false}}]});
  result.splice(5,0,{path:'/reports',name:'Reports',component:'/index/index',meta:{title:'检查报告',icon:'ri:file-list-line'},children:[{path:'index',name:'ReportList',component:'/admin/reports',meta:{title:'报告列表',keepAlive:false}}]});
  return result;
}
