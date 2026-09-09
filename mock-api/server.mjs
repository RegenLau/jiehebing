import { registerProjects } from './projects.mjs';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import XLSX from 'xlsx';
import { createFixtures, createMenu, shanghaiDate, shiftDate } from './fixtures.mjs';

class ApiError extends Error {
  constructor(message, code = 422, httpStatus = 200) { super(message); this.code = code; this.httpStatus = httpStatus; }
}
const assert = (condition, message, code = 422) => { if (!condition) throw new ApiError(message, code); };
const integer = (v, fallback = 0) => Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback;
const clean = value => String(value ?? '').trim();
const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const descId = rows => [...rows].sort((a, b) => b.id - a.id);
const safeAdmin = ({ password, ...admin }) => admin;
function page(rows, query) {
  const current = Math.max(1, integer(query.current ?? query.page, 1));
  const size = Math.max(1, Math.min(100, integer(query.size ?? query.limit, 10)));
  return { list: rows.slice((current - 1) * size, current * size), total: rows.length, current, size };
}
function legacyPage(rows, query) {
  const p = page(rows, query);
  return { data: p.list, total: p.total, current_page: p.current, per_page: p.size, last_page: Math.max(1, Math.ceil(p.total / p.size)) };
}
function find(rows, id, label) {
  const record = rows.find(r => r.id === integer(id));
  assert(record, `${label}不存在`, 404);
  return record;
}
function statusFilter(rows, query) {
  return query.status === undefined || query.status === '' ? rows : rows.filter(r => r.status === integer(query.status));
}
function sendJson(res, data, message = 'success') {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ code: 200, message, data }));
}
function spreadsheet(res, name, headers, rows) {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet['!cols'] = headers.map(() => ({ wch: 24 }));
  XLSX.utils.book_append_sheet(book, sheet, '模拟数据');
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
  res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' });
  res.end(buffer);
}

/** A fully isolated server. Calling this function does not listen or perform network requests. */
export function createMockServer({ now = () => new Date() } = {}) {
  const clock = () => new Date(typeof now === 'function' ? now() : now);
  const today = () => shanghaiDate(clock());
  const timestamp = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(clock());
  const db = createFixtures(clock());
  const sessions = new Map();
  const captchas = new Map();
  const nextId = rows => Math.max(0, ...rows.map(r => r.id)) + 1;
  const invalidateSessions = id => { for (const [token, session] of sessions) if (session.id === id) sessions.delete(token); };
  const userInfo = admin => ({ ...safeAdmin(admin), realname: admin.realname || admin.username, roles: ['R_ADMIN'], buttons: ['*'], dashboard: '/dashboard/console', department: { id: 1, name: '模拟管理团队' } });
  const answerCount = id => db.answers.filter(a => a.template_id === id).reduce((sum, a) => sum + a.values.length, 0);
  const answerDetail = (userId, templateId) => {
    find(db.patients, userId, '患者');
    const s = find(db.surveys, templateId, '问卷');
    const a = db.answers.find(a => a.user_id === integer(userId) && a.template_id === s.id);
    assert(a, '该患者暂未作答此问卷');
    return { template: { id: s.id, code: s.code, name: s.name, description: s.description, fillable_day: s.fillableDay }, submitted_at: a.submitted_at,
      questions: s.questions.map(q => {
        const value = a.values.find(v => v.question_id === q.id);
        const selected = q.options.filter(o => value?.option_ids.includes(o.id)).map(o => ({ id: o.id, label: o.label, is_exclusive: o.isExclusive, trigger_input: o.triggerInput,
          input_fields: (o.inputFields || []).map(f => ({ field_key: f.field_key, field_label: f.field_label, value: value?.extra_inputs[f.field_key] || '' })) }));
        return { question_id: q.id, question_no: q.questionNo, title: q.title, type: q.type, required: Boolean(q.required), placeholder: q.placeholder,
          answered: Boolean(value), text_value: value?.text_value || '', selected_options: selected,
          answer_summary: q.type === 'TEXT' ? value?.text_value || '-' : selected.map(o => o.label).join('、') || '-' };
      }) };
  };
  const adverseRows = q => db.adverse.filter(r => (!q.patient_name || r.patient_name.includes(q.patient_name)) && (!integer(q.user_id) || r.user_id === integer(q.user_id)) && (![1, 2, 3].includes(integer(q.severity)) || r.severity === integer(q.severity))).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.id - a.id);
  const routes = new Map();
  const route = (method, path, handler) => routes.set(`${method} ${path}`, handler);
  const core = (method, path, handler) => route(method, `/app/core/${path}`, handler);
  core('GET', 'system/user', ({ admin }) => userInfo(admin));
  core('GET', 'system/menu', () => createMenu());
  core('GET', 'system/dictAll', () => ({ gender: [{ label: '男', value: '1' }, { label: '女', value: '2' }] }));
  registerProjects({ core, db, assert, find, page, clean, isDate, timestamp, nextId });
  core('GET', 'admin/index', () => descId(db.admins).map(safeAdmin));
  const saveAdmin = ({ body: b }, update) => {
    const existing = update ? find(db.admins, b.id, '管理员') : undefined;
    const username = clean(b.username);
    assert(username, '用户名不能为空');
    assert(!db.admins.some(a => a.username === username && a !== existing), '用户名已存在');
    assert(existing || clean(b.password), '密码不能为空');
    const status = integer(b.status, 1);
    assert([0, 1].includes(status), '状态值不合法');
    const changedPassword = Boolean(clean(b.password)) && b.password !== existing?.password;
    const row = existing || { id: nextId(db.admins), created_at: timestamp(), gender: '1' };
    Object.assign(row, { username, phone: clean(b.phone), email: clean(b.email), avatar: clean(b.avatar) || row.avatar || '/api/mock-files/admin-avatar', status, updated_at: timestamp() });
    if (clean(b.password)) row.password = String(b.password);
    if (!existing) db.admins.push(row);
    if (existing && (status === 0 || changedPassword)) invalidateSessions(row.id);
    return safeAdmin(row);
  };
  core('POST', 'admin/save', ctx => saveAdmin(ctx, false));
  core('POST', 'admin/update', ctx => saveAdmin(ctx, true));
  core('GET', 'patient/index', ({ query }) => page(descId(db.patients), query));
  core('GET', 'patient/detail', ({ query }) => find(db.patients, query.user_id, '患者'));
  core('GET', 'patient/medicine-list', ({ query }) => { find(db.patients, query.user_id, '患者'); return page(descId(db.medicines.filter(m => m.user_id === integer(query.user_id))), query); });
  core('GET', 'patient/survey-status', ({ query }) => {
    const p = find(db.patients, query.user_id, '患者');
    return db.surveys.filter(s => s.status === 1).map(s => {
      const a = db.answers.find(a => a.user_id === p.id && a.template_id === s.id);
      const fillableDate = p.enroll_date ? shiftDate(p.enroll_date, s.fillableDay) : null;
      return { template_id: s.id, code: s.code, name: s.name, description: s.description, fillable_day: s.fillableDay, fillable_date: fillableDate,
        fillable: Boolean(fillableDate && today() >= fillableDate), answered: Boolean(a), submitted_at: a?.submitted_at || '', answer_count: a?.values.length || 0 };
    });
  });
  core('GET', 'patient/survey-answer-detail', ({ query }) => answerDetail(query.user_id, query.template_id));
  core('GET', 'medication-plan/index', ({ query: q }) => {
    const scope = q.scope || 'today';
    const overdue = ['true', '1'].includes(q.overdue);
    const asOf = isDate(q.as_of) ? q.as_of : today();
    const overdueRange = ['7d', '30d'].includes(q.overdue_range) ? q.overdue_range : '';
    const start = shiftDate(asOf, -(overdueRange === '7d' ? 6 : 29));
    const rows = db.plans.filter(r => (!q.patient_name || r.patient_name.includes(q.patient_name)) && (!integer(q.user_id) || r.user_id === integer(q.user_id))
      && (scope !== 'today' || r.plan_date === today()) && (!q.plan_date || r.plan_date === q.plan_date)
      && (!overdue || r.plan_date < asOf) && (!overdue || !overdueRange || r.plan_date >= start));
    const filtered = ['0', '1'].includes(q.status) ? statusFilter(rows, q) : rows;
    return { ...page(filtered.sort((a, b) => b.plan_date.localeCompare(a.plan_date) || a.plan_time.localeCompare(b.plan_time) || b.id - a.id), q), scope };
  });
  core('GET', 'adverse-reaction/index', ({ query }) => page(adverseRows(query), query));
  core('GET', 'adverse-reaction/export', ({ query, res }) => spreadsheet(res, 'adverse_reaction_mock.xlsx', ['ID', '患者姓名', '手机号', '发生时间', '主要症状', '症状描述', '严重程度', '处理建议', '状态', '上报时间'], adverseRows(query).map(r => [r.id, r.patient_name, r.patient_mobile, r.occurred_at, r.symptom_summary, r.symptom_description, r.severity_text, r.advice_text, r.status_text, r.created_at])));
  core('GET', 'dashboard/overview', ({ query: q }) => {
    const range = ['today', '7d', '30d'].includes(q.range) ? q.range : 'today';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(q.date || '') && !Number.isNaN(Date.parse(q.date)) ? q.date : today();
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 1;
    const start = shiftDate(date, -(days - 1));
    const dates = Array.from({ length: days }, (_, i) => shiftDate(start, i));
    const plans = db.plans.filter(p => p.plan_date >= start && p.plan_date <= date);
    const adverse = db.adverse.filter(a => a.occurred_at.slice(0, 10) >= start && a.occurred_at.slice(0, 10) <= date);
    const archived = db.patients.filter(p => p.is_archived).length;
    return { range, date, metrics: { patient_total: db.patients.length, archived_total: archived, expected_total: plans.length, completed_total: plans.filter(p => p.status === 1).length, new_adverse_total: adverse.length },
      archive: { archived, unarchived: db.patients.length - archived }, resources: { survey_total: db.surveys.length, article_total: db.articles.length, medicine_total: db.commonMedicines.length },
      todos: { overdue_total: db.plans.filter(p => p.status === 0 && p.plan_date < date && (range === 'today' || p.plan_date >= start)).length, pending_review_total: adverse.length },
      trend: { labels: dates.map(d => d.slice(5)), expected: dates.map(d => plans.filter(p => p.plan_date === d).length), completed: dates.map(d => plans.filter(p => p.plan_date === d && p.status === 1).length) },
      adverse_severity: { mild: adverse.filter(a => a.severity === 1).length, moderate: adverse.filter(a => a.severity === 2).length, severe: adverse.filter(a => a.severity === 3).length } };
  });
  core('GET', 'common-medicine/index', ({ query: q }) => page(statusFilter(db.commonMedicines.filter(m => !q.keyword || [m.common_name, m.company, m.ybm].some(v => v.includes(q.keyword))), q).sort((a, b) => a.sort_order - b.sort_order || b.id - a.id), q));
  const toggle = (rows, label) => ({ body: b }) => { assert([0, 1].includes(Number(b.status)), '状态值不合法'); const item = find(rows, b.id, label); item.status = Number(b.status); if ('status_text' in item) item.status_text = item.status ? '启用' : '停用'; return { id: item.id, status: item.status }; };
  core('POST', 'common-medicine/toggle-status', toggle(db.commonMedicines, '常用药品'));
  core('GET', 'health-article/index', ({ query: q }) => page(statusFilter(db.articles.filter(a => !q.keyword || a.title.includes(q.keyword) || a.summary.includes(q.keyword)), q).sort((a, b) => b.sort - a.sort || b.id - a.id).map(({ content, ...a }) => a), q));
  core('GET', 'health-article/detail', ({ query }) => find(db.articles, query.id, '文章'));
  core('POST', 'health-article/toggle-status', toggle(db.articles, '文章'));
  core('POST', 'health-article/save', ({ body: b }) => {
    const a = integer(b.id) ? find(db.articles, b.id, '文章') : { id: nextId(db.articles), view_count: 0, created_at: timestamp() };
    assert(clean(b.title), '文章标题不能为空'); assert(clean(b.summary), '文章摘要不能为空'); assert(clean(b.content), '文章内容不能为空');
    const status = integer(b.status, 1); const sort = integer(b.sort);
    assert([0, 1].includes(status), '状态值不合法'); assert(sort >= 0, '排序值不能小于0');
    Object.assign(a, { title: clean(b.title), summary: clean(b.summary), content: clean(b.content), cover: clean(b.cover), sort, status, published_at: clean(b.published_at ?? b.publishedAt) || timestamp(), updated_at: timestamp() });
    if (!integer(b.id)) db.articles.push(a);
    return a;
  });
  core('GET', 'survey/index', ({ query: q }) => page(descId(statusFilter(db.surveys.filter(s => !q.keyword || s.name.includes(q.keyword) || s.code.includes(q.keyword)), q)).map(({ questions, updatedAt, ...s }) => ({ ...s, questionCount: questions.length, answerCount: answerCount(s.id) })), q));
  core('GET', 'survey/detail', ({ query }) => find(db.surveys, query.id, '问卷模板'));
  core('POST', 'survey/toggle-status', toggle(db.surveys, '问卷模板'));
  core('POST', 'survey/delete', ({ body: b }) => { const s = find(db.surveys, b.id, '问卷模板'); assert(!db.projectGroups.some(g => g.surveys.some(r => r.id === s.id)), '问卷已被研究分组引用，无法删除，请改为停用'); assert(!answerCount(s.id), '该问卷已有作答记录，无法删除，请改为停用'); db.surveys.splice(db.surveys.indexOf(s), 1); return { id: s.id }; });
  core('POST', 'survey/save', ({ body: b }) => {
    const old = integer(b.id) ? find(db.surveys, b.id, '问卷模板') : null;
    const code = clean(b.code); const name = clean(b.name); const description = clean(b.description);
    assert(code && code.length <= 64, '模板编码必填且不超过64字符'); assert(name && name.length <= 128, '模板名称必填且不超过128字符'); assert(description.length <= 256, '问卷说明不超过256字符');
    assert(!db.surveys.some(s => s !== old && s.code === code), '模板编码已存在');
    const fillableDay = Number(b.fillableDay ?? b.fillable_day ?? 0); const status = Number(b.status ?? 1);
    assert(Number.isInteger(fillableDay) && fillableDay >= 0, '可填写天数不合法'); assert([0, 1].includes(status), '状态值不合法');
    assert(Array.isArray(b.questions) && b.questions.length, '至少需要一道题目');
    let nextQuestion = Math.max(0, ...db.surveys.flatMap(s => s.questions.map(q => q.id))) + 1;
    let nextOption = Math.max(0, ...db.surveys.flatMap(s => s.questions.flatMap(q => q.options.map(o => o.id)))) + 1;
    const questions = b.questions.map(raw => {
      const id = integer(raw.id); const previous = old?.questions.find(q => q.id === id);
      assert(!id || previous, '题目ID非法');
      const q = { id: id || nextQuestion++, questionNo: Number(raw.questionNo ?? raw.question_no), title: clean(raw.title), type: clean(raw.type), required: Number(raw.required ?? 1), sortOrder: Number(raw.sortOrder ?? raw.sort_order ?? 0), placeholder: clean(raw.placeholder), options: [] };
      assert(Number.isInteger(q.questionNo) && q.questionNo > 0, '题号不合法'); assert(q.title && q.title.length <= 512, '题干必填且不超过512字符');
      assert(['RADIO', 'CHECKBOX', 'TEXT'].includes(q.type), '题型不合法'); assert([0, 1].includes(q.required), '必填标记不合法'); assert(q.sortOrder >= 0 && Number.isInteger(q.sortOrder), '题目排序不合法'); assert(q.placeholder.length <= 256, '占位提示不超过256字符');
      if (previous && answerCount(old.id)) assert(previous.type === q.type, '该问卷已有作答记录，无法修改题型，请停用后新建');
      if (q.type !== 'TEXT') {
        assert(Array.isArray(raw.options) && raw.options.length, '选择题至少需要一个选项');
        q.options = raw.options.map(o => {
          const oid = integer(o.id); assert(!oid || previous?.options.some(p => p.id === oid), '选项ID非法');
          const option = { id: oid || nextOption++, label: clean(o.label), sortOrder: Number(o.sortOrder ?? o.sort_order ?? 0), isExclusive: Boolean(o.isExclusive ?? o.is_exclusive), triggerInput: Boolean(o.triggerInput ?? o.trigger_input), inputFields: o.inputFields ?? o.input_fields ?? null };
          assert(option.label && option.label.length <= 128, '选项文案必填且不超过128字符'); assert(Number.isInteger(option.sortOrder) && option.sortOrder >= 0, '选项排序不合法');
          if (option.triggerInput) assert(Array.isArray(option.inputFields) && option.inputFields.length && option.inputFields.every(f => clean(f.field_key) && clean(f.field_label)), '条件输入字段缺少 field_key/field_label');
          if (!option.triggerInput) option.inputFields = null;
          return option;
        });
      }
      if (previous && answerCount(old.id)) assert(previous.options.every(o => q.options.some(n => n.id === o.id)), '该问卷已有作答记录，无法删除选项，请停用后新建');
      assert(new Set(q.options.map(o => o.id)).size === q.options.length, '选项ID重复');
      return q;
    });
    assert(new Set(questions.map(q => q.questionNo)).size === questions.length, '题号不能重复');
    assert(new Set(questions.map(q => q.id)).size === questions.length, '题目ID重复');
    if (old && answerCount(old.id)) assert(old.questions.every(q => questions.some(n => n.id === q.id)), '该问卷已有作答记录，无法删除题目，请停用后新建');
    const s = old || { id: nextId(db.surveys), createdAt: timestamp() };
    Object.assign(s, { code, name, description, fillableDay, status, questions, updatedAt: timestamp() });
    if (!old) db.surveys.push(s);
    return { id: s.id };
  });
  core('GET', 'survey/export', ({ query, res }) => {
    const s = find(db.surveys, query.id, '问卷模板');
    const rows = db.answers.filter(a => a.template_id === s.id).map(a => {
      const p = find(db.patients, a.user_id, '患者'); const detail = answerDetail(p.id, s.id);
      return [p.id, p.name, p.mobile, a.submitted_at, ...detail.questions.map(q => q.type === 'TEXT' ? q.text_value : q.selected_options.map(o => o.label + (o.input_fields.length ? `（${o.input_fields.map(f => `${f.field_label}：${f.value}`).join('；')}）` : '')).join('、'))];
    });
    spreadsheet(res, 'survey_answers_mock.xlsx', ['患者ID', '患者姓名', '手机号', '提交时间', ...s.questions.map(q => `第${q.questionNo}题 ${q.title}`)], rows);
  });
  core('POST', 'file/upload-file', async ({ body, res }) => {
    const file = body.get?.('file');
    assert(file && typeof file.arrayBuffer === 'function', '文件不能为空');
    assert(['image/jpeg', 'image/png', 'image/gif', 'application/pdf'].includes(file.type), '仅支持 JPG、PNG、GIF 图片和 PDF 文件');
    assert(file.size <= 10 * 1024 * 1024, '文件不能超过10MB');
    const id = randomUUID();
    db.files.set(id, { buffer: Buffer.from(await file.arrayBuffer()), type: file.type, name: file.name, created_at: timestamp() });
    return { url: `/api/mock-files/${id}` };
  });
  route('POST', '/core/user/updateInfo', ({ body, admin }) => {
    for (const field of ['realname', 'gender', 'email', 'phone', 'avatar', 'signed']) if (field in body) admin[field] = clean(body[field]);
    admin.updated_at = timestamp(); return userInfo(admin);
  });
  route('POST', '/core/user/modifyPassword', ({ body, admin }) => {
    assert(String(body.oldPassword || '') === admin.password, '当前密码错误');
    assert(clean(body.newPassword).length >= 6, '新密码至少6位');
    assert(body.newPassword === body.confirmPassword, '两次输入的密码不一致');
    admin.password = String(body.newPassword); admin.updated_at = timestamp(); invalidateSessions(admin.id); return [];
  });
  route('GET', '/core/system/getLoginLogList', ({ query, admin }) => legacyPage(descId(db.loginLogs.filter(l => l.admin_id === admin.id)), query));
  route('GET', '/core/system/getOperationLogList', ({ query, admin }) => legacyPage(descId(db.operationLogs.filter(l => l.admin_id === admin.id)), query));
  route('GET', '/core/system/clearAllCache', () => ({ cleared: true }));
  route('GET', '/core/system/getResourceCategory', () => [{ id: 1, value: 1, name: '本地模拟资源', label: '本地模拟资源', children: [] }]);
  route('GET', '/core/system/getResourceList', ({ query: q }) => legacyPage([...db.files.entries()].filter(([, f]) => f.type.startsWith('image/') && (!q.object_name || f.name.includes(q.object_name)) && (!q.category_id || q.category_id === '1')).map(([id, f]) => ({ id, origin_name: f.name, url: `/api/mock-files/${id}`, size_info: `${Math.ceil(f.buffer.length / 1024)} KB`, category_id: 1, type: f.type, createTime: f.created_at })), q));

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      if (req.method === 'GET' && path === '/health') return sendJson(res, { mode: 'mock', date: today() });
      if (req.method === 'POST' && path === '/app/core/logout') {
        const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
        sessions.delete(token); return sendJson(res, []);
      }
      if (req.method === 'GET' && path.startsWith('/mock-files/')) {
        const file = db.files.get(path.slice('/mock-files/'.length));
        if (!file) throw new ApiError('模拟文件不存在（服务重启后上传文件会清空）', 404, 404);
        res.writeHead(200, { 'Content-Type': file.type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); return res.end(file.buffer);
      }
      const publicCaptcha = req.method === 'GET' && ['/app/core/captcha', '/app/admin/captcha'].includes(path);
      const publicLogin = req.method === 'POST' && ['/app/core/login', '/app/admin/login'].includes(path);
      if (publicCaptcha) {
        for (const [id, expires] of captchas) if (expires <= clock().getTime()) captchas.delete(id);
        const uuid = randomUUID(); captchas.set(uuid, clock().getTime() + 300000);
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="140" height="46"><rect width="140" height="46" rx="5" fill="#edf5fa"/><text x="70" y="32" text-anchor="middle" font-size="28" letter-spacing="5" fill="#1d5275">1234</text></svg>';
        return sendJson(res, { result: 1, uuid, image: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` });
      }
      const handler = routes.get(`${req.method} ${path}`);
      if (!publicLogin && !handler) throw new ApiError('该接口未实现本地 Mock', 404, 404);
      let admin;
      if (!publicLogin) {
        const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
        const session = sessions.get(token);
        admin = db.admins.find(a => a.id === session?.id);
        assert(session && session.expires > clock().getTime() && admin?.status === 1, '登录已过期，请重新登录', 401);
      }
      let body = {};
      if (req.method === 'POST') {
        const chunks = []; let length = 0;
        for await (const chunk of req) { length += chunk.length; if (length > 12 * 1024 * 1024) throw new ApiError('请求内容过大', 413, 413); chunks.push(chunk); }
        const buffer = Buffer.concat(chunks); const contentType = req.headers['content-type'] || '';
        if (contentType.includes('multipart/form-data')) body = await new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': contentType }, body: buffer }).formData();
        else if (contentType.includes('application/x-www-form-urlencoded')) body = Object.fromEntries(new URLSearchParams(buffer.toString()));
        else if (buffer.length) { try { body = JSON.parse(buffer.toString()); } catch { throw new ApiError('请求数据格式不正确'); } }
        assert(body && typeof body === 'object' && !Array.isArray(body), '请求数据格式不正确');
      }
      if (publicLogin) {
        const expires = captchas.get(body.uuid);
        assert(expires && expires > clock().getTime() && String(body.code) === '1234', '验证码错误或已过期');
        captchas.delete(body.uuid);
        admin = db.admins.find(a => a.username === clean(body.username) && a.password === String(body.password) && a.status === 1);
        assert(admin, '用户名或密码错误', 401);
        const token = randomUUID(); sessions.set(token, { id: admin.id, expires: clock().getTime() + 28800000 });
        db.loginLogs.push({ id: nextId(db.loginLogs), admin_id: admin.id, login_time: timestamp(), ip_location: '本地模拟环境', os: '浏览器', ip: '127.0.0.1' });
        return sendJson(res, { token_type: 'Bearer', expires_in: 28800, access_token: token, refresh_token: '' });
      }
      const result = await handler({ req, res, body, query: Object.fromEntries(url.searchParams), admin });
      if (req.method === 'POST') db.operationLogs.push({ id: nextId(db.operationLogs), admin_id: admin.id, create_time: timestamp(), service_name: '模拟数据操作', router: path, ip_location: '本地模拟环境' });
      if (!res.writableEnded) sendJson(res, result ?? [], req.method === 'POST' ? '操作成功' : 'success');
    } catch (error) {
      if (!res.writableEnded) {
        res.writeHead(error.httpStatus || 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ code: error.code || 500, message: error instanceof ApiError ? error.message : '模拟服务处理失败，请检查请求内容', data: null }));
      }
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createMockServer();
  server.on('error', error => { console.error(`Mock 服务启动失败：${error.code || error.message}`); process.exitCode = 1; });
  server.listen(3010, '127.0.0.1', () => console.log('Mock API 已启动：http://127.0.0.1:3010（仅本机，数据重启清空）'));
}
