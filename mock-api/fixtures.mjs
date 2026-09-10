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
    id: i + 1, code: `TB-RESEARCH-00${i + 1}`, name: ['结核病院外随访研究', '结核病规范用药随访研究', '结核病随访试点'][i],
    center: '结核病研究中心', investigator: '项目负责人', phone: '010-00000000',
    start_date: shiftDate(today, status === 0 ? 7 : -90), end_date: shiftDate(today, status === 2 ? -1 : 180),
    protocol_version: 'V1.0', effective_date: shiftDate(today, -100), purpose: '开展结核病患者院外用药管理与随访。', notes: '',
    research_type: ['open', 'single_blind', 'double_blind'][i], status, created_at: time, updated_at: time, history: [{ action: '初始化', operator: '系统', time, note: '创建研究项目' }]
  }));
  const patientProfiles = [
    ['林安然', '13910001001', 2, '1988-03-12'], ['周明远', '13910001002', 1, '1979-11-26'],
    ['陈嘉禾', '13910001003', 1, '1992-07-08'], ['赵清妍', '13910001004', 2, '1985-01-19'],
    ['孙景行', '13910001005', 1, '1971-09-03'], ['吴念慈', '13910001006', 2, '1996-05-22'],
    ['郑云帆', '13910001007', 1, '1982-12-14'], ['王舒宁', '13910001008', 2, '1990-04-30'],
    ['冯知远', '13910001009', 1, '1968-08-17'], ['褚静宜', '13910001010', 2, '1976-02-09'],
    ['卫向晨', '13910001011', 1, '1998-10-05'], ['蒋若溪', '13910001012', 2, '1987-06-28'],
    ['沈致远', '13910001013', 1, '1974-03-16'], ['韩书瑶', '13910001014', 2, '1994-09-21'],
    ['杨修文', '13910001015', 1, '1980-01-07'], ['朱清和', '13910001016', 2, '1965-11-11'],
    ['秦望舒', '13910001017', 2, '1999-07-24'], ['许承安', '13910001018', 1, '1983-05-13'],
    ['何雨晴', '13910001019', 2, '1978-12-02'], ['吕知行', '13910001020', 1, '1991-08-09'],
    ['施婉宁', '13910001021', 2, '1986-04-18'], ['张怀瑾', '13910001022', 1, '1970-10-27'],
    ['孔思齐', '13910001023', 1, '1995-02-15'], ['曹静姝', '13910001024', 2, '1981-06-06'],
    ['严嘉树', '13910001025', 1, '1989-09-12'], ['华安琪', '13910001026', 2, '1973-01-25'],
    ['金予安', '13910001027', 1, '1997-11-08'], ['魏清越', '13910001028', 2, '1984-05-31']
  ];
  const patients = patientProfiles.map(([name, mobile, gender, birth_date], i) => {
    const offset = i < 12 ? -(40 + i) : i < 16 ? -(i - 11) : -(i + 3);
    const enroll_date = shiftDate(today, offset);
    return {
      id: i + 1, patient_code: `TB-P-${String(i + 1).padStart(3, '0')}`, name, mobile, gender,
      gender_text: gender === 1 ? '男' : '女', birth_date, age: ageOnDate(birth_date, today),
      is_archived: 1, login_enabled: true, created_via: 'admin', study_state: '待启用',
      enroll_date, offline_confirmed: true, consent_confirmed: true,
      identity_confirmed: false, medicine_confirmed: false, status: 1,
      created_at: `${enroll_date} 06:00:00`, updated_at: time
    };
  });
  const drugNames = ['异烟肼片', '利福平胶囊', '吡嗪酰胺片', '盐酸乙胺丁醇片'];
  const commonMedicines = Array.from({ length: 16 }, (_, i) => ({
    id: i + 1, common_name: drugNames[i % 4], company: '', specification: '以药品包装为准',
    ybm: `DRUG-${String(i + 1).padStart(3, '0')}`, usage: '口服', frequency: 1,
    dosage: '遵医嘱', dosage_value: '1', dosage_unit: '片', medication_guidance: '具体用药请遵医嘱。',
    thumb: '/api/mock-files/medicine-cover', sort_order: i, status: i % 5 ? 1 : 0,
    status_text: i % 5 ? '启用' : '停用', created_at: `${shiftDate(today, -60)} 06:00:00`, updated_at: time
  }));
  const adverse = Array.from({ length: 36 }, (_, i) => {
    const p = patients[i % 24];
    const severity = i % 3 + 1;
    const symptoms = [['头晕'], ['恶心', '食欲下降'], ['皮疹']][i % 3];
    const proposedDate = shiftDate(today, -(i % 30));
    const occurred_at = `${proposedDate < p.enroll_date ? p.enroll_date : proposedDate} 10:30:00`;
    return { id: i + 1, user_id: p.id, patient_name: p.name, patient_mobile: p.mobile, occurred_at,
      symptoms, symptom_summary: symptoms.join('、'), symptom_description: `患者反馈出现${symptoms.join('、')}。`, severity,
      severity_text: ['轻度', '中度', '重度'][severity - 1], advice_text: '请联系医生评估。',
      status: i % 4 === 0 ? 2 : 1, status_text: i % 4 === 0 ? '已处理' : '已上报', created_at: occurred_at };
  });
  const titleList = ['您最近有无新增或减少药物？', '您最近服用药物的剂量和频次是否有变化？', '您最近有没有到医院复查？', '服药以后有没有出现不舒服（如头晕、皮疹、恶心等）？', '最近 2 周内，有没有以下情况？（可多选）', '您最想问药师或医生的用药问题是：'];
  const questions = titleList.map((title, i) => {
    const labels = i === 0
      ? ['首次开始', '没有', '有']
      : i === 4
        ? ['忘记吃药', '自己减量或停药', '自行增加剂量', '以上都没有']
        : ['没有', '有'];
    return {
      id: i + 1, questionNo: i + 1, title, type: i === 5 ? 'TEXT' : i === 4 ? 'CHECKBOX' : 'RADIO',
      required: i === 5 ? 0 : 1, sortOrder: i + 1, placeholder: i === 5 ? '请输入您的问题' : '',
      options: i === 5 ? [] : labels.map((label, j) => {
        const triggerInput = i < 4 && label === '有';
        const placeholder = i === 0
          ? '请填写药名'
          : i === 1
            ? '例如：异烟肼片，一天三片'
            : '请输入说明';
        return {
          id: (i + 1) * 10 + j + 1, label, sortOrder: j + 1, isExclusive: i === 4 && j === 3,
          triggerInput,
          inputFields: triggerInput ? [{
            field_key: `detail_${i + 1}`,
            field_label: i === 1 ? '药品名称和用药频次变化' : '补充说明',
            field_type: 'text',
            required: true,
            placeholder
          }] : null
        };
      })
    };
  });
  const surveys = [
    { id: 1, code: 'TB_FOLLOWUP_V1', name: '结核病随访问卷', description: '了解近期用药、复查及身体状况。', fillableDay: 7, status: 1, createdAt: `${shiftDate(today, -60)} 06:00:00`, updatedAt: `${shiftDate(today, -60)} 06:00:00`, questions },
    { id: 2, code: 'TB_FOLLOWUP_DRAFT', name: '随访问卷草稿', description: '暂无作答，可编辑或删除。', fillableDay: 30, status: 0, createdAt: time, updatedAt: time,
      questions: [{ id: 7, questionNo: 1, title: '请填写本次随访备注', type: 'TEXT', required: 0, sortOrder: 1, placeholder: '请输入备注', options: [] }] }
  ];
  const answers = patients.filter(p => p.id >= 5 && p.id <= 12).map(p => ({ user_id: p.id, template_id: 1, submitted_at: `${[shiftDate(today, -1), shiftDate(p.enroll_date, surveys[0].fillableDay)].sort().at(-1)} 14:00:00`,
    values: questions.map(q => ({ question_id: q.id, option_ids: q.type === 'TEXT' ? [] : [q.options[q.type === 'CHECKBOX' ? 3 : p.id % 2].id], text_value: q.type === 'TEXT' ? '希望了解复查安排。' : '', extra_inputs: { [`detail_${q.id}`]: '详见本次随访记录' } })) }));
  const articles = Array.from({ length: 13 }, (_, i) => ({
    id: i + 1, title: ['规范用药与随访', '复查前的准备', '健康生活小贴士', '用药记录管理', '随访问题整理', '检查报告归档', '不适症状记录', '复诊资料准备', '取药安排管理', '每日健康反馈', '个人健康档案', '随访问卷填写', '就诊沟通记录'][i], cover: '/api/mock-files/article-cover',
    summary: '了解用药、复查与日常健康记录的管理要点。', content: '<h2>随访健康科普</h2><p>请按医生安排完成随访与复查。</p>',
    view_count: 30 + i * 7, sort: i, status: i % 4 ? 1 : 0, published_at: `${shiftDate(today, -i)} 09:00:00`, created_at: `${shiftDate(today, -i)} 09:00:00`, updated_at: time
  }));
  const admins = [{ id: 1, username: 'admin', password: 'Mock123456', realname: '管理员', gender: '1', email: 'admin@example.invalid', phone: '13800000000', avatar: '/api/mock-files/admin-avatar', status: 1, created_at: time, updated_at: time }];
  const files = new Map();
  for (const [id, title, color] of [['article-cover', '随访健康科普', '#2b76b7'], ['medicine-cover', '药品资料', '#269b88'], ['admin-avatar', '管理', '#557cc4']]) {
    const buffer = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" rx="24" fill="${color}"/><text x="320" y="190" text-anchor="middle" font-size="36" fill="white">${title}</text></svg>`);
    files.set(id, { buffer, type: 'image/svg+xml', name: `${id}.svg`, created_at: time });
  }
  const medicationSchemes = [1, 2, 3].map((id) => ({
    id, name: `用药方案 ${id}`, description: '具体用药安排由医生评估确认。', version: 'V1.0', status: id === 3 ? 0 : 1,
    drugs: commonMedicines.filter(m => m.status === 1).slice(id - 1, id + 1).map(m => ({ drug_id: m.id, name: m.common_name, specification: m.specification, dose: m.dosage_value, unit: m.dosage_unit, frequency: '每日1次', times: '08:00', precautions: m.medication_guidance }))
  }));
  const taskTemplates = ['检查', '复诊', '取药', '报告提交'].map((type,i) => ({ id:i+1, name:`${type}模板`, type, status:1, version:'V1.0', description:`按研究安排完成${type}`, requirements: i === 0 || i === 3 ? '提交检查日期及报告原图' : '提交完成日期和补充说明' }));
  const reminderSchemes = [
    {
      id: 1,
      name: '标准研究提醒',
      description: '覆盖用药、随访任务和取药的常规提醒方案。',
      status: 1,
      revision: 1,
      version: 'V1',
      medication_enabled: true,
      medication_advance_minutes: 0,
      task_start_enabled: true,
      task_due_enabled: true,
      task_overdue_enabled: true,
      task_remind_time: '09:00',
      pickup_enabled: true,
      pickup_advance_days: 5,
      pickup_remind_time: '09:00',
      created_at: time,
      updated_at: time,
      history: []
    },
    {
      id: 2,
      name: '轻量随访提醒',
      description: '保留服药、任务开始与到期、取药提醒，不重复发送逾期提醒。',
      status: 1,
      revision: 1,
      version: 'V1',
      medication_enabled: true,
      medication_advance_minutes: 10,
      task_start_enabled: true,
      task_due_enabled: true,
      task_overdue_enabled: false,
      task_remind_time: '10:00',
      pickup_enabled: true,
      pickup_advance_days: 3,
      pickup_remind_time: '10:00',
      created_at: time,
      updated_at: time,
      history: []
    },
    {
      id: 3,
      name: '历史提醒方案',
      description: '已停用，供已关联小组查看历史快照。',
      status: 0,
      revision: 1,
      version: 'V1',
      medication_enabled: true,
      medication_advance_minutes: 0,
      task_start_enabled: true,
      task_due_enabled: false,
      task_overdue_enabled: false,
      task_remind_time: '09:00',
      pickup_enabled: false,
      pickup_advance_days: 0,
      pickup_remind_time: '09:00',
      created_at: time,
      updated_at: time,
      history: []
    }
  ];
  const groupDefinitions = [
    { id: 1, project_id: 1, name: '筹备标准随访组', description: '筹备阶段的标准随访管理分组。', scheme_id: 1, reminder_scheme_id: 1, task_ids: [1, 2], participant_ids: patients.slice(8, 13).map(p => p.id) },
    { id: 2, project_id: 1, name: '筹备强化随访组', description: '筹备阶段的强化提醒与复查管理分组。', scheme_id: 2, reminder_scheme_id: 2, task_ids: [1, 3], participant_ids: patients.slice(13, 18).map(p => p.id) },
    { id: 3, project_id: 2, name: '规范用药随访组', description: '开展规范用药、定期复查及随访问卷管理。', scheme_id: 1, reminder_scheme_id: 1, task_ids: [1, 2], participant_ids: patients.slice(18, 23).map(p => p.id) },
    { id: 4, project_id: 2, name: '强化管理随访组', description: '开展加强提醒、取药和报告提交管理。', scheme_id: 2, reminder_scheme_id: 2, task_ids: [1, 3, 4], participant_ids: patients.slice(23).map(p => p.id) },
    { id: 5, project_id: 3, name: '历史完成随访组', description: '用于查看已结束项目的历史分组配置。', scheme_id: 1, reminder_scheme_id: 1, task_ids: [1, 2], participant_ids: patients.slice(0, 4).map(p => p.id) },
    { id: 6, project_id: 3, name: '历史重点复核组', description: '用于查看已结束项目的重点复核配置。', scheme_id: 2, reminder_scheme_id: 2, task_ids: [1, 4], participant_ids: patients.slice(4, 8).map(p => p.id) }
  ];
  const schedule = (source, reminder, interval_days, offset_days = 0) => ({
    id: source.id, snapshot: structuredClone(source), anchor: 'enrollment', date: '', offset_days, interval_days, deadline_days: 3,
    reminders: { start: reminder.task_start_enabled, due: reminder.task_due_enabled, overdue: reminder.task_overdue_enabled }
  });
  const projectGroups = groupDefinitions.map(definition => {
    const scheme = medicationSchemes.find(item => item.id === definition.scheme_id);
    const reminder = reminderSchemes.find(item => item.id === definition.reminder_scheme_id);
    const participants = definition.participant_ids.map(id => {
      const patient = patients.find(item => item.id === id);
      return { id: patient.id, name: patient.name, mobile: patient.mobile };
    });
    return {
      id: definition.id, project_id: definition.project_id, name: definition.name, description: definition.description, revision: 2,
      medication: { id: scheme.id, snapshot: structuredClone(scheme), treatment_days: 180, pickup_days: 30, advance_days: reminder.pickup_enabled ? reminder.pickup_advance_days : 0, quantities: scheme.drugs.map(drug => ({ drug_id: drug.drug_id, quantity: 30 })) },
      reminder: { id: reminder.id, snapshot: structuredClone(reminder) },
      surveys: [schedule(surveys[0], reminder, definition.id % 2 ? 14 : 7)],
      tasks: definition.task_ids.map((id, index) => schedule(taskTemplates.find(item => item.id === id), reminder, 30, index * 3)),
      participant_ids: definition.participant_ids, participants, created_at: time, updated_at: time
    };
  });
  for (const group of projectGroups) {
    const project = projects.find(item => item.id === group.project_id);
    for (const patientId of group.participant_ids) {
      const patient = patients.find(item => item.id === patientId);
      Object.assign(patient, { project_id: project.id, project_name: project.name, group_id: group.id, group_name: group.name, medication_scheme_id: group.medication.id, medication_scheme_name: group.medication.snapshot.name, owner_id: admins[0].id, owner_name: admins[0].realname });
    }
  }
  const medicines = [];
  const plans = [];
  let nextMedicine = 1;
  let nextPlan = 1;
  for (const patient of patients) {
    const group = projectGroups.find(item => item.id === patient.group_id);
    for (const [sort, drug] of group.medication.snapshot.drugs.entries()) {
      const source = commonMedicines.find(item => item.id === drug.drug_id);
      const times = drug.times.split(',').map(value => value.trim());
      const quantity = group.medication.quantities.find(item => item.drug_id === drug.drug_id)?.quantity || 0;
      const medicine = {
        ...source, id: nextMedicine++, user_id: patient.id, common_medicine_id: source.id, name: source.common_name,
        project_id: group.project_id, group_id: group.id, group_name: group.name, medication_scheme_id: group.medication.id,
        medication_scheme_name: group.medication.snapshot.name, remark: `来自研究分组“${group.name}”`, trade_name: source.common_name,
        medicine_count: String(quantity), batch_no: `BATCH-${patient.id}-${String(sort + 1).padStart(2, '0')}`, sort,
        source: 'group', source_text: '研究分组方案', usage: '口服', dosage: `${drug.dose}${drug.unit}/次`,
        dosage_value: String(drug.dose), dosage_unit: drug.unit, frequency: times.length, plan_times: times,
        medication_guidance: drug.precautions, created_at: `${patient.enroll_date} 07:00:00`, updated_at: time
      };
      medicines.push(medicine);
      for (let day = -35; day <= 3; day++) {
        const plan_date = shiftDate(today, day);
        if (plan_date < patient.enroll_date) continue;
        for (const [planIndex, planTime] of times.entries()) {
          const status = day > 0 ? 0 : (medicine.id + day + planIndex + 100) % 5 === 0 ? 0 : 1;
          plans.push({
            ...medicine, id: nextPlan++, medicine_id: medicine.id, patient_name: patient.name, patient_mobile: patient.mobile,
            plan_date, day_number: Math.round((Date.parse(plan_date) - Date.parse(patient.enroll_date)) / 86400000) + 1,
            plan_time: planTime, plan_index: planIndex + 1, status, status_text: status ? '已打卡' : '待打卡',
            checked_at: status ? `${plan_date} ${planTime}:00` : '', created_at: medicine.created_at
          });
        }
      }
    }
  }
  return { projects, projectGroups, medicationSchemes, reminderSchemes, taskTemplates, patients, medicines, plans, adverse, commonMedicines, surveys, answers, articles, admins, files, loginLogs: [], operationLogs: [] };
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
  result[1].children.push({ path: 'management', name: 'PatientManagement', component: '/admin/patient-management', meta: { title: '患者研究管理', isHide: true, activePath: '/patient/index', keepAlive: false } });
  result.splice(1, 0, { path: '/project', name: 'Project', component: '/index/index', meta: { title: 'menus.project.title', icon: 'ri:folder-chart-line' },
    children: [
      { path: 'index', name: 'ProjectIndex', component: '/admin/project', meta: { title: 'menus.project.list', keepAlive: true } },
      { path: 'groups', name: 'ProjectGroups', component: '/admin/project-groups', meta: { title: '研究分组', isHide: true, activePath: '/project/index', keepAlive: false } },
      { path: 'group', name: 'ProjectGroup', component: '/admin/project-group', meta: { title: '分组配置', isHide: true, activePath: '/project/index', keepAlive: false } }
    ] });
  const medication = result.find(r => r.name === 'MedicationPlan');
  medication.meta.title = '用药管理';
  medication.children.unshift({path:'schemes',name:'MedicationSchemes',component:'/admin/medication-schemes',meta:{title:'用药方案',keepAlive:false}});
  result.splice(4,0,{path:'/followup',name:'Followup',component:'/index/index',meta:{title:'随访任务',icon:'ri:calendar-check-line'},children:[{path:'feedback',name:'FeedbackRecords',component:'/admin/feedback',meta:{title:'每日反馈记录',keepAlive:false}},{path:'index',name:'FollowupTasks',component:'/admin/followup',meta:{title:'任务列表',keepAlive:false}},{path:'templates',name:'TaskTemplates',component:'/admin/task-templates',meta:{title:'任务模板',keepAlive:false}},{path:'reminder-schemes',name:'ReminderSchemes',component:'/admin/reminder-schemes',meta:{title:'提醒方案',keepAlive:false}}]});
  result.splice(5,0,{path:'/reports',name:'Reports',component:'/index/index',meta:{title:'检查报告',icon:'ri:file-list-line'},children:[{path:'index',name:'ReportList',component:'/admin/reports',meta:{title:'报告列表',keepAlive:false}}]});
  return result;
}
