import { registerResearchExport } from "./research-export.mjs";
import { registerFeedback } from "./feedback.mjs";
import { registerMedicationRecords } from "./medication-records.mjs";
import {
  registerAdverseManagement,
  withAdverseMembership,
} from "./adverse-management.mjs";
import { registerReports } from "./reports.mjs";
import { registerFollowup } from "./followup.mjs";
import { registerPatientManagement } from "./patient-management.mjs";
import { registerTaskTemplates } from "./task-templates.mjs";
import { registerMedicationSchemes } from "./medication-schemes.mjs";
import { registerReminderSchemes } from "./reminder-schemes.mjs";
import { registerProjects } from "./projects.mjs";
import { registerPatientApp } from "./patient-app.mjs";
import { effectiveProjectStatus } from "./project-status.mjs";
import { snapshotGroupExecution } from "./execution-snapshot.mjs";
import { refreshPatientStudyState } from "./patient-study-state.mjs";
import {
  buildPatientTasks,
  currentTreatmentFor,
  upcomingTreatmentFor,
} from "./patient-tasks.mjs";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import XLSX from "xlsx";
import {
  createFixtures,
  createMenu,
  shanghaiDate,
  shiftDate,
} from "./fixtures.mjs";

class ApiError extends Error {
  constructor(message, code = 422, httpStatus = 200) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
const assert = (condition, message, code = 422) => {
  if (!condition) throw new ApiError(message, code);
};
const integer = (v, fallback = 0) =>
  Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback;
const clean = (value) => String(value ?? "").trim();
const isDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const descId = (rows) => [...rows].sort((a, b) => b.id - a.id);
const safeAdmin = ({ password, ...admin }) => admin;
function page(rows, query) {
  const current = Math.max(1, integer(query.current ?? query.page, 1));
  const size = Math.max(
    1,
    Math.min(100, integer(query.size ?? query.limit, 10)),
  );
  return {
    list: rows.slice((current - 1) * size, current * size),
    total: rows.length,
    current,
    size,
  };
}
function legacyPage(rows, query) {
  const p = page(rows, query);
  return {
    data: p.list,
    total: p.total,
    current_page: p.current,
    per_page: p.size,
    last_page: Math.max(1, Math.ceil(p.total / p.size)),
  };
}
function find(rows, id, label) {
  const record = rows.find((r) => r.id === integer(id));
  assert(record, `${label}不存在`, 404);
  return record;
}
function statusFilter(rows, query) {
  return query.status === undefined || query.status === ""
    ? rows
    : rows.filter((r) => r.status === integer(query.status));
}
function sendJson(res, data, message = "success") {
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify({ code: 200, message, data }));
}
function sendPatientJson(res, data, message = "成功") {
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify({ code: 0, message, data }));
}
function spreadsheet(res, name, headers, rows, columnWidths = []) {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet["!cols"] = headers.map((_, index) => ({
    wch: columnWidths[index] || 24,
  }));
  XLSX.utils.book_append_sheet(book, sheet, "数据明细");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  res.writeHead(200, {
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${name}"`,
    "Cache-Control": "no-store",
  });
  res.end(buffer);
}

/** A fully isolated server. Calling this function does not listen or perform network requests. */
export function createMockServer({ now = () => new Date() } = {}) {
  const clock = () => new Date(typeof now === "function" ? now() : now);
  const today = () => shanghaiDate(clock());
  const timestamp = () =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(clock());
  const db = createFixtures(clock());
  db.patientExecutionSnapshots = db.patients.map((patient) => {
    const group = db.projectGroups.find((row) => row.id === patient.group_id);
    return {
      user_id: patient.id,
      ...(group ? snapshotGroupExecution(group) : {}),
    };
  });
  for (const survey of db.surveys) survey.version = 1;
  for (const [index, answer] of db.answers.entries()) {
    answer.id ||= index + 1;
    answer.template_snapshot = structuredClone(
      db.surveys.find((s) => s.id === answer.template_id),
    );
  }
  const sessions = new Map();
  const patientSessions = new Map();
  const captchas = new Map();
  const nextId = (rows) => Math.max(0, ...rows.map((r) => r.id)) + 1;
  const invalidateSessions = (id) => {
    for (const [token, session] of sessions)
      if (session.id === id) sessions.delete(token);
  };
  const userInfo = (admin) => ({
    ...safeAdmin(admin),
    realname: admin.realname || admin.username,
    roles: ["R_ADMIN"],
    buttons: ["*"],
    dashboard: "/dashboard/console",
    department: { id: 1, name: "随访管理团队" },
  });
  const surveyAnswers = (id) =>
    db.answers.filter((answer) => answer.template_id === id);
  const submissionCount = (id) => surveyAnswers(id).length;
  const participantCount = (id) =>
    new Set(surveyAnswers(id).map((answer) => answer.user_id)).size;
  const answerRowCount = (id) =>
    surveyAnswers(id).reduce((sum, answer) => sum + answer.values.length, 0);
  const nextSurveyCode = () => {
    const prefix = `WJ${today().replaceAll("-", "")}`;
    let sequence = 1;
    let code = `${prefix}${String(sequence).padStart(4, "0")}`;
    while (db.surveys.some((survey) => survey.code === code)) {
      sequence += 1;
      code = `${prefix}${String(sequence).padStart(4, "0")}`;
    }
    return code;
  };
  const answerDetail = ({ userId, templateId, answerId, taskId, answer }) => {
    const directAnswer =
      answer ||
      (answerId
        ? db.answers.find((row) => row.id === integer(answerId))
        : null);
    const resolvedUserId = integer(userId) || directAnswer?.user_id;
    find(db.patients, resolvedUserId, "患者");
    const a =
      directAnswer ||
      db.answers.find(
        (row) =>
          row.user_id === resolvedUserId &&
          (taskId
            ? String(row.task_id) === String(taskId)
            : row.template_id === integer(templateId)),
      );
    if (userId)
      assert(a?.user_id === integer(userId), "问卷作答记录不属于该患者");
    assert(a, "该患者暂未作答此问卷");
    const current = db.surveys.find((row) => row.id === a.template_id);
    const s = a.template_snapshot || current;
    assert(s, "问卷快照不存在");
    return {
      answer_id: a.id,
      task_id: a.task_id || null,
      template: {
        id: s.id,
        code: s.code,
        name: s.name,
        description: s.description,
        fillable_day: s.fillableDay,
      },
      submitted_at: a.submitted_at,
      questions: s.questions.map((q) => {
        const value = a.values.find((v) => v.question_id === q.id);
        const selected = q.options
          .filter((o) => value?.option_ids.includes(o.id))
          .map((o) => ({
            id: o.id,
            label: o.label,
            is_exclusive: o.isExclusive,
            trigger_input: o.triggerInput,
            input_fields: (o.inputFields || []).map((f) => ({
              field_key: f.field_key,
              field_label: f.field_label,
              value: value?.extra_inputs[f.field_key] || "",
            })),
          }));
        return {
          question_id: q.id,
          question_no: q.questionNo,
          title: q.title,
          type: q.type,
          required: Boolean(q.required),
          placeholder: q.placeholder,
          answered: Boolean(value),
          text_value: value?.text_value || "",
          selected_options: selected,
          answer_summary:
            q.type === "TEXT"
              ? value?.text_value || "-"
              : selected.map((o) => o.label).join("、") || "-",
        };
      }),
    };
  };
  const adverseRows = (q) => {
    assert(!q.as_of || isDate(q.as_of), "统计截止日期不合法");
    return db.adverse
      .map((r) => withAdverseMembership(r, db))
      .filter(
        (r) =>
          (q.pending !== "1" ||
            ((r.processing_status || "待处理") !== "已处理" &&
              (!q.as_of || r.occurred_at.slice(0, 10) <= q.as_of))) &&
          (!q.processing_status ||
            (r.processing_status || "待处理") === q.processing_status) &&
          (!q.patient_name ||
            `${r.patient_name} ${r.patient_code}`.includes(q.patient_name)) &&
          (!integer(q.user_id) || r.user_id === integer(q.user_id)) &&
          (!integer(q.project_id) || r.project_id === integer(q.project_id)) &&
          (!integer(q.group_id) || r.group_id === integer(q.group_id)) &&
          (!integer(q.owner_id) ||
            (r.owner_id || r.assessment?.owner_id) === integer(q.owner_id)) &&
          (![1, 2, 3].includes(integer(q.severity)) ||
            r.severity === integer(q.severity)),
      )
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.id - a.id)
      ;
  };
  const routes = new Map();
  const patientRoutes = new Map();
  const route = (method, path, handler) =>
    routes.set(`${method} ${path}`, handler);
  const core = (method, path, handler) =>
    route(method, `/app/core/${path}`, handler);
  const patientRoute = (method, path, handler) =>
    patientRoutes.set(`${method} ${path}`, handler);
  core("GET", "system/user", ({ admin }) => userInfo(admin));
  core("GET", "system/menu", () => createMenu());
  core("GET", "system/dictAll", () => ({
    gender: [
      { label: "男", value: "1" },
      { label: "女", value: "2" },
    ],
  }));
  registerTaskTemplates({
    core,
    db,
    assert,
    find,
    page,
    clean,
    timestamp,
    nextId,
  });
  registerMedicationSchemes({
    core,
    db,
    assert,
    find,
    page,
    clean,
    timestamp,
    nextId,
  });
  registerReminderSchemes({
    core,
    db,
    assert,
    find,
    page,
    clean,
    timestamp,
    nextId,
  });
  registerProjects({
    core,
    db,
    assert,
    find,
    page,
    clean,
    isDate,
    timestamp,
    nextId,
    today,
  });
  registerResearchExport({
    core,
    db,
    assert,
    clean,
    today,
    shiftDate,
    spreadsheet,
  });
  core("GET", "admin/index", () => descId(db.admins).map(safeAdmin));
  const saveAdmin = ({ body: b }, update) => {
    const existing = update ? find(db.admins, b.id, "管理员") : undefined;
    const username = clean(b.username);
    assert(username, "用户名不能为空");
    assert(
      !db.admins.some((a) => a.username === username && a !== existing),
      "用户名已存在",
    );
    assert(existing || clean(b.password), "密码不能为空");
    const status = integer(b.status, 1);
    assert([0, 1].includes(status), "状态值不合法");
    const changedPassword =
      Boolean(clean(b.password)) && b.password !== existing?.password;
    const row = existing || {
      id: nextId(db.admins),
      created_at: timestamp(),
      gender: "1",
    };
    Object.assign(row, {
      realname: clean(b.realname ?? row.realname),
      hospital_name: clean(b.hospital_name ?? row.hospital_name),
      department_name: clean(b.department_name ?? row.department_name),
      username,
      phone: clean(b.phone),
      email: clean(b.email),
      avatar: clean(b.avatar) || row.avatar || "/api/mock-files/admin-avatar",
      status,
      updated_at: timestamp(),
    });
    if (clean(b.password)) row.password = String(b.password);
    if (!existing) db.admins.push(row);
    if (existing && (status === 0 || changedPassword))
      invalidateSessions(row.id);
    return safeAdmin(row);
  };
  core("POST", "admin/save", (ctx) => saveAdmin(ctx, false));
  core("POST", "admin/update", (ctx) => saveAdmin(ctx, true));
  registerFollowup({
    core,
    db,
    assert,
    find,
    page,
    clean,
    isDate,
    timestamp,
    nextId,
    today,
    shiftDate,
  });
  registerAdverseManagement({ core, db, assert, find, clean, timestamp });
  registerFeedback({
    core,
    db,
    assert,
    find,
    page,
    clean,
    isDate,
    timestamp,
    nextId,
    today,
    shiftDate,
  });
  registerReports({
    core,
    db,
    assert,
    find,
    page,
    clean,
    isDate,
    timestamp,
    nextId,
  });
  registerMedicationRecords({
    core,
    db,
    assert,
    find,
    clean,
    isDate,
    timestamp,
    nextId,
    today,
    shiftDate,
  });
  registerPatientManagement({
    core,
    db,
    assert,
    find,
    page,
    clean,
    isDate,
    timestamp,
    nextId,
    today,
    shiftDate,
  });
  registerPatientApp({
    patientRoute,
    db,
    assert,
    clean,
    isDate,
    timestamp,
    nextId,
    today,
    shiftDate,
    randomUUID,
  });
  core("GET", "patient/detail", ({ query }) => {
    const patient = find(db.patients, query.user_id, "患者");
    refreshPatientStudyState({ db, patient, date: today() });
    const current = currentTreatmentFor({ db, patient, date: today() });
    const upcoming = upcomingTreatmentFor({ db, patient, date: today() });
    const treatment = current || upcoming;
    return {
      ...patient,
      arrangement_ready: Boolean(treatment),
      arrangement_type: treatment
        ? treatment.adjusted
          ? "个体调整"
          : "分组方案"
        : "待确认方案",
      current_treatment_id: current?.id || null,
      upcoming_treatment_id: upcoming?.id || null,
    };
  });
  core("GET", "patient/medicine-list", ({ query }) => {
    find(db.patients, query.user_id, "患者");
    const medicines = descId(
      db.medicines.filter((m) => m.user_id === integer(query.user_id)),
    ).map((medicine) => ({
      ...medicine,
      medication_guidance:
        db.commonMedicines.find(
          (item) => item.id === medicine.common_medicine_id,
        )?.medication_guidance || "",
    }));
    return page(medicines, query);
  });
  core("GET", "patient/survey-status", ({ query }) => {
    const p = find(db.patients, query.user_id, "患者");
    const tasks = buildPatientTasks({
      db,
      patient: p,
      today,
      shiftDate,
      timestamp,
      includeFuture: true,
    }).filter((row) => row.type === "问卷");
    const rows = [];
    const includedAnswers = new Set();
    for (const task of tasks) {
      const survey =
        task.snapshot?.snapshot ||
        db.surveys.find((row) => row.id === task.binding_id);
      if (!survey) continue;
      const answer = db.answers.find(
        (row) =>
          row.user_id === p.id && String(row.task_id) === String(task.id),
      );
      if (answer) includedAnswers.add(answer.id);
      rows.push({
        task_id: task.id,
        answer_id: answer?.id || null,
        template_id: survey.id,
        code: survey.code,
        name: survey.name,
        description: survey.description,
        fillable_day: survey.fillableDay,
        fillable_date: task.date,
        plan_date: task.date,
        due_date: task.due_date,
        status: answer ? "已完成" : task.status,
        overdue: !answer && task.due_date < today(),
        fillable: !answer && task.date <= today(),
        answered: Boolean(answer),
        submitted_at: answer?.submitted_at || "",
        answer_count: answer?.values.length || 0,
      });
    }
    for (const answer of db.answers.filter(
      (row) => row.user_id === p.id && !includedAnswers.has(row.id),
    )) {
      const survey =
        answer.template_snapshot ||
        db.surveys.find((row) => row.id === answer.template_id);
      if (!survey) continue;
      rows.push({
        task_id: answer.task_id || null,
        answer_id: answer.id,
        template_id: survey.id,
        code: survey.code,
        name: survey.name,
        description: survey.description,
        fillable_day: survey.fillableDay,
        fillable_date: p.enroll_date
          ? shiftDate(p.enroll_date, survey.fillableDay)
          : answer.submitted_at.slice(0, 10),
        plan_date: answer.submitted_at.slice(0, 10),
        due_date: answer.submitted_at.slice(0, 10),
        status: "已完成",
        overdue: false,
        fillable: false,
        answered: true,
        submitted_at: answer.submitted_at,
        answer_count: answer.values.length,
      });
    }
    const roundCounter = new Map();
    return rows
      .sort(
        (left, right) =>
          left.plan_date.localeCompare(right.plan_date) ||
          String(left.task_id || "").localeCompare(String(right.task_id || "")),
      )
      .map((row) => {
        const round = (roundCounter.get(row.template_id) || 0) + 1;
        roundCounter.set(row.template_id, round);
        return { ...row, round_no: round };
      })
      .reverse();
  });
  core("GET", "patient/survey-answer-detail", ({ query }) =>
    answerDetail({
      userId: query.user_id,
      templateId: query.template_id,
      answerId: query.answer_id,
      taskId: query.task_id,
    }),
  );
  core("GET", "medication-plan/index", ({ query: q }) => {
    const scope = q.scope || "today";
    const overdue = ["true", "1"].includes(q.overdue);
    const asOf = isDate(q.as_of) ? q.as_of : today();
    const overdueRange = ["7d", "30d"].includes(q.overdue_range)
      ? q.overdue_range
      : "";
    const start = shiftDate(asOf, -(overdueRange === "7d" ? 6 : 29));
    const rows = db.plans.filter(
      (r) =>
        (!q.patient_name ||
          `${r.patient_name} ${db.patients.find((patient) => patient.id === r.user_id)?.patient_code || ""}`.includes(q.patient_name)) &&
        (!integer(q.user_id) || r.user_id === integer(q.user_id)) &&
        (!integer(q.project_id) || r.project_id === integer(q.project_id)) &&
        (!integer(q.group_id) || r.group_id === integer(q.group_id)) &&
        (scope !== "today" || r.plan_date === today()) &&
        (!q.plan_date || r.plan_date === q.plan_date) &&
        (!q.start_date || r.plan_date >= q.start_date) &&
        (!q.end_date || r.plan_date <= q.end_date) &&
        (!overdue || r.plan_date < asOf) &&
        (!overdue || !overdueRange || r.plan_date >= start),
    );
    const filtered = ["0", "1", "2", "3"].includes(q.status)
      ? statusFilter(rows, q)
      : rows;
    return {
      ...page(
        filtered
          .sort(
            (a, b) =>
              b.plan_date.localeCompare(a.plan_date) ||
              a.plan_time.localeCompare(b.plan_time) ||
              b.id - a.id,
          )
          .map((row) => ({
            ...row,
            patient_code:
              db.patients.find((patient) => patient.id === row.user_id)
                ?.patient_code || `P${row.user_id}`,
          })),
        q,
      ),
      scope,
    };
  });
  core("GET", "adverse-reaction/index", ({ query }) =>
    page(adverseRows(query), query),
  );
  core("GET", "adverse-reaction/export", ({ query, res }) =>
    spreadsheet(
      res,
      "adverse_reaction.xlsx",
      [
        "ID",
        "患者编号",
        "患者姓名",
        "手机号",
        "参与项目",
        "入组名称",
        "发生时间",
        "主要症状",
        "症状描述",
        "严重程度",
        "处理建议",
        "上报状态",
        "处理状态",
        "负责人",
        "最后处理时间",
        "最后联系结果",
        "上报时间",
      ],
      adverseRows(query).map((r) => {
        const patient = db.patients.find((row) => row.id === r.user_id);
        const latestContact = r.contacts?.[0];
        return [
          r.id,
          patient?.patient_code || `P${r.user_id}`,
          r.patient_name,
          r.patient_mobile,
          r.project_name || "未参与项目",
          r.group_name || "未入组",
          r.occurred_at,
          r.symptom_summary,
          r.symptom_description,
          r.severity_text,
          r.advice_text,
          r.status_text,
          r.processing_status || "待处理",
          r.owner_name || r.assessment?.owner_name || "未分配",
          latestContact?.time || "",
          latestContact?.result || "",
          r.created_at,
        ];
      }),
    ),
  );
  core("GET", "dashboard/research", ({ query: q }) => {
    for (const patient of db.patients)
      refreshPatientStudyState({ db, patient, date: today() });
    const patients = db.patients.filter(
        (p) =>
          (!integer(q.project_id) || p.project_id === integer(q.project_id)) &&
          (!integer(q.group_id) || p.group_id === integer(q.group_id)),
      ),
      ids = new Set(patients.map((p) => p.id)),
      tasks = db.followupTasks.filter((t) => ids.has(t.user_id)),
      reports = db.reports.filter((r) => ids.has(r.user_id)),
      events = db.adverse.filter((a) => ids.has(a.user_id));
    return {
      patients: patients.length,
      treating: patients.filter((p) => p.study_state === "治疗中").length,
      completed: patients.filter((p) => p.study_state === "已完成").length,
      withdrawn: patients.filter((p) => p.study_state === "提前退出").length,
      reports_pending: reports.filter((r) => r.status === "待核对").length,
      events_pending: events.filter(
        (a) => (a.processing_status || "待处理") !== "已处理",
      ).length,
      tasks_overdue: tasks.filter(
        (t) => t.due_date < today() && !["已完成", "已取消"].includes(t.status),
      ).length,
      tasks_completed: tasks.filter((t) => t.status === "已完成").length,
      tasks_total: tasks.length,
    };
  });
  core("GET", "dashboard/overview", ({ query: q }) => {
    for (const patient of db.patients)
      refreshPatientStudyState({ db, patient, date: today() });
    const range = ["today", "7d", "30d"].includes(q.range) ? q.range : "today";
    const date =
      /^\d{4}-\d{2}-\d{2}$/.test(q.date || "") &&
      !Number.isNaN(Date.parse(q.date))
        ? q.date
        : today();
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 1;
    const start = shiftDate(date, -(days - 1));
    const dates = Array.from({ length: days }, (_, i) => shiftDate(start, i));
    const patients = db.patients.filter(
      (p) =>
        (!integer(q.project_id) || p.project_id === integer(q.project_id)) &&
        (!integer(q.group_id) || p.group_id === integer(q.group_id)),
    );
    const patientIds = new Set(patients.map((p) => p.id));
    const plans = db.plans.filter(
      (p) =>
        patientIds.has(p.user_id) &&
        p.plan_date >= start &&
        p.plan_date <= date,
    );
    const adverse = db.adverse.filter(
      (a) =>
        patientIds.has(a.user_id) &&
        a.occurred_at.slice(0, 10) >= start &&
        a.occurred_at.slice(0, 10) <= date,
    );
    const pendingAdverse = db.adverse.filter(
      (a) =>
        patientIds.has(a.user_id) &&
        a.occurred_at.slice(0, 10) <= date &&
        (a.processing_status || "待处理") !== "已处理",
    );
    const archived = patients.filter((p) => p.is_archived).length;
    return {
      range,
      date,
      metrics: {
        patient_total: patients.length,
        archived_total: archived,
        expected_total: plans.length,
        completed_total: plans.filter((p) => p.status === 1).length,
        new_adverse_total: adverse.length,
      },
      login: {
        enabled: patients.filter((p) => p.login_enabled).length,
        disabled: patients.filter((p) => !p.login_enabled).length,
      },
      // Keep the legacy shape for existing consumers while the workbench uses login.
      archive: { archived, unarchived: patients.length - archived },
      resources: {
        survey_total: db.surveys.length,
        article_total: db.articles.length,
        medicine_total: db.commonMedicines.length,
      },
      todos: {
        overdue_total: db.plans.filter(
          (p) =>
            patientIds.has(p.user_id) &&
            p.status === 0 &&
            p.plan_date < date &&
            (range === "today" || p.plan_date >= start),
        ).length,
        pending_review_total: pendingAdverse.length,
        pending_report_total: db.reports.filter(
          (r) => patientIds.has(r.user_id) && r.status === "待核对",
        ).length,
      },
      trend: {
        labels: dates.map((d) => d.slice(5)),
        expected: dates.map(
          (d) => plans.filter((p) => p.plan_date === d).length,
        ),
        completed: dates.map(
          (d) =>
            plans.filter((p) => p.plan_date === d && p.status === 1).length,
        ),
      },
      adverse_severity: {
        mild: adverse.filter((a) => a.severity === 1).length,
        moderate: adverse.filter((a) => a.severity === 2).length,
        severe: adverse.filter((a) => a.severity === 3).length,
      },
    };
  });
  core("GET", "common-medicine/index", ({ query: q }) =>
    page(
      statusFilter(
        db.commonMedicines.filter(
          (m) =>
            !q.keyword ||
            [m.common_name, m.company, m.ybm].some((v) =>
              v.includes(q.keyword),
            ),
        ),
        q,
      ).sort((a, b) => a.sort_order - b.sort_order || b.id - a.id),
      q,
    ),
  );
  const toggle =
    (rows, label) =>
    ({ body: b }) => {
      assert([0, 1].includes(Number(b.status)), "状态值不合法");
      const item = find(rows, b.id, label);
      item.status = Number(b.status);
      if ("status_text" in item)
        item.status_text = item.status ? "启用" : "停用";
      return { id: item.id, status: item.status };
    };
  core(
    "POST",
    "common-medicine/toggle-status",
    toggle(db.commonMedicines, "常用药品"),
  );
  core("POST", "common-medicine/save-guidance", ({ body: b }) => {
    const medicine = find(db.commonMedicines, b.id, "常用药品");
    const medication_guidance = clean(b.medication_guidance);
    assert(medication_guidance.length <= 50000, "用药指导不能超过50000字");
    Object.assign(medicine, { medication_guidance, updated_at: timestamp() });
    return medicine;
  });
  core("GET", "health-article/index", ({ query: q }) =>
    page(
      statusFilter(
        db.articles.filter(
          (a) =>
            !q.keyword ||
            a.title.includes(q.keyword) ||
            a.summary.includes(q.keyword),
        ),
        q,
      )
        .sort((a, b) => b.sort - a.sort || b.id - a.id)
        .map(({ content, ...a }) => a),
      q,
    ),
  );
  core("GET", "health-article/detail", ({ query }) =>
    find(db.articles, query.id, "文章"),
  );
  core("POST", "health-article/toggle-status", (ctx) => {
    const result = toggle(db.articles, "文章")(ctx);
    if (result.status === 1) {
      const a = find(db.articles, result.id, "文章");
      a.confirmed_by = ctx.admin.realname || ctx.admin.username;
      a.confirmed_at = timestamp();
    }
    return result;
  });
  core("POST", "health-article/save", ({ body: b, admin }) => {
    const a = integer(b.id)
      ? find(db.articles, b.id, "文章")
      : { id: nextId(db.articles), view_count: 0, created_at: timestamp() };
    assert(clean(b.title), "文章标题不能为空");
    assert(clean(b.summary), "文章摘要不能为空");
    assert(clean(b.content), "文章内容不能为空");
    const status = integer(b.status, 1);
    const sort = integer(b.sort);
    assert([0, 1].includes(status), "状态值不合法");
    assert(sort >= 0, "排序值不能小于0");
    Object.assign(a, {
      title: clean(b.title),
      summary: clean(b.summary),
      content: clean(b.content),
      cover: clean(b.cover),
      sort,
      status,
      confirmed_by: admin.realname || admin.username,
      confirmed_at: timestamp(),
      published_at: clean(b.published_at ?? b.publishedAt) || timestamp(),
      updated_at: timestamp(),
    });
    if (!integer(b.id)) db.articles.push(a);
    return a;
  });
  core("GET", "survey/index", ({ query: q }) =>
    page(
      descId(
        statusFilter(
          db.surveys.filter(
            (s) =>
              !q.keyword ||
              s.name.includes(q.keyword) ||
              s.code.includes(q.keyword),
          ),
          q,
        ),
      ).map(({ questions, updatedAt, ...s }) => ({
        ...s,
        questionCount: questions.length,
        answerCount: submissionCount(s.id),
        participantCount: participantCount(s.id),
        answerRowCount: answerRowCount(s.id),
      })),
      q,
    ),
  );
  core("GET", "survey/detail", ({ query }) =>
    find(db.surveys, query.id, "问卷模板"),
  );
  core("POST", "survey/toggle-status", ({ body: b }) => {
    assert([0, 1].includes(Number(b.status)), "状态值不合法");
    const survey = find(db.surveys, b.id, "问卷模板");
    if (Number(b.status) === 1)
      assert(survey.questions.length, "请先添加题目，再启用问卷");
    survey.status = Number(b.status);
    survey.updatedAt = timestamp();
    return { id: survey.id, status: survey.status };
  });
  core("POST", "survey/delete", ({ body: b }) => {
    const s = find(db.surveys, b.id, "问卷模板");
    assert(
      !db.projectGroups.some((g) => g.surveys.some((r) => r.id === s.id)),
      "问卷已被研究分组引用，无法删除，请改为停用",
    );
    assert(!submissionCount(s.id), "该问卷已有作答记录，无法删除，请改为停用");
    db.surveys.splice(db.surveys.indexOf(s), 1);
    return { id: s.id };
  });
  core("POST", "survey/save", ({ body: b, admin }) => {
    const old = integer(b.id) ? find(db.surveys, b.id, "问卷模板") : null;
    if (old && b.version !== undefined)
      assert(b.version === (old.version || 1), "问卷已更新，请刷新后编辑");
    const before = old
      ? structuredClone({
          name: old.name,
          description: old.description,
          questions: old.questions,
          version: old.version || 1,
        })
      : null;
    const code = old?.code || nextSurveyCode();
    const name = clean(b.name);
    const description = clean(b.description);
    assert(code.length <= 64, "问卷编号不能超过64字符");
    assert(name && name.length <= 128, "问卷标题必填且不超过128字符");
    assert(description.length <= 256, "问卷说明不超过256字符");
    assert(
      !db.surveys.some((s) => s !== old && s.code === code),
      "模板编码已存在",
    );
    const fillableDay = Number(b.fillableDay ?? b.fillable_day ?? 0);
    const status = Number(b.status ?? old?.status ?? 0);
    assert(
      Number.isInteger(fillableDay) && fillableDay >= 0,
      "可填写天数不合法",
    );
    assert([0, 1].includes(status), "状态值不合法");
    const rawQuestions = b.questions ?? [];
    assert(Array.isArray(rawQuestions), "题目数据格式不正确");
    if (old) assert(rawQuestions.length, "至少需要一道题目");
    let nextQuestion =
      Math.max(0, ...db.surveys.flatMap((s) => s.questions.map((q) => q.id))) +
      1;
    let nextOption =
      Math.max(
        0,
        ...db.surveys.flatMap((s) =>
          s.questions.flatMap((q) => q.options.map((o) => o.id)),
        ),
      ) + 1;
    const questions = rawQuestions.map((raw) => {
      const id = integer(raw.id);
      const previous = old?.questions.find((q) => q.id === id);
      assert(!id || previous, "题目ID非法");
      const q = {
        id: id || nextQuestion++,
        questionNo: Number(raw.questionNo ?? raw.question_no),
        title: clean(raw.title),
        type: clean(raw.type),
        required: Number(raw.required ?? 1),
        sortOrder: Number(raw.sortOrder ?? raw.sort_order ?? 0),
        placeholder: clean(raw.placeholder),
        options: [],
      };
      assert(Number.isInteger(q.questionNo) && q.questionNo > 0, "题号不合法");
      assert(q.title && q.title.length <= 512, "题干必填且不超过512字符");
      assert(["RADIO", "CHECKBOX", "TEXT"].includes(q.type), "题型不合法");
      assert([0, 1].includes(q.required), "必填标记不合法");
      assert(
        q.sortOrder >= 0 && Number.isInteger(q.sortOrder),
        "题目排序不合法",
      );
      assert(q.placeholder.length <= 256, "占位提示不超过256字符");
      if (previous && submissionCount(old.id))
        assert(
          previous.type === q.type,
          "该问卷已有作答记录，无法修改题型，请停用后新建",
        );
      if (q.type !== "TEXT") {
        assert(
          Array.isArray(raw.options) && raw.options.length,
          "选择题至少需要一个选项",
        );
        q.options = raw.options.map((o) => {
          const oid = integer(o.id);
          assert(
            !oid || previous?.options.some((p) => p.id === oid),
            "选项ID非法",
          );
          const option = {
            id: oid || nextOption++,
            label: clean(o.label),
            sortOrder: Number(o.sortOrder ?? o.sort_order ?? 0),
            isExclusive: Boolean(o.isExclusive ?? o.is_exclusive),
            triggerInput: Boolean(o.triggerInput ?? o.trigger_input),
            inputFields: o.inputFields ?? o.input_fields ?? null,
          };
          assert(
            option.label && option.label.length <= 128,
            "选项文案必填且不超过128字符",
          );
          assert(
            Number.isInteger(option.sortOrder) && option.sortOrder >= 0,
            "选项排序不合法",
          );
          if (option.triggerInput)
            assert(
              Array.isArray(option.inputFields) &&
                option.inputFields.length &&
                option.inputFields.every(
                  (f) => clean(f.field_key) && clean(f.field_label),
                ),
              "条件输入字段缺少 field_key/field_label",
            );
          if (!option.triggerInput) option.inputFields = null;
          return option;
        });
      }
      if (previous && submissionCount(old.id))
        assert(
          previous.options.every((o) => q.options.some((n) => n.id === o.id)),
          "该问卷已有作答记录，无法删除选项，请停用后新建",
        );
      assert(
        new Set(q.options.map((o) => o.id)).size === q.options.length,
        "选项ID重复",
      );
      return q;
    });
    assert(
      new Set(questions.map((q) => q.questionNo)).size === questions.length,
      "题号不能重复",
    );
    assert(
      new Set(questions.map((q) => q.id)).size === questions.length,
      "题目ID重复",
    );
    if (old && submissionCount(old.id))
      assert(
        old.questions.every((q) => questions.some((n) => n.id === q.id)),
        "该问卷已有作答记录，无法删除题目，请停用后新建",
      );
    const s = old || { id: nextId(db.surveys), createdAt: timestamp() };
    Object.assign(s, {
      code,
      name,
      description,
      fillableDay,
      status,
      questions,
      version: (old?.version || 0) + 1,
      updatedAt: timestamp(),
    });
    s.history ||= [];
    s.history.unshift({
      time: timestamp(),
      operator: admin.realname || admin.username,
      before,
      after: structuredClone({
        name,
        description,
        questions,
        version: s.version,
      }),
    });
    if (!old) db.surveys.push(s);
    return { id: s.id, code: s.code };
  });
  core("GET", "survey/export", ({ query, res }) => {
    const current = find(db.surveys, query.id, "问卷模板");
    const s =
      db.answers.find((a) => a.template_id === current.id)?.template_snapshot ||
      current;
    const projectId = integer(query.project_id);
    const groupId = integer(query.group_id);
    const startDate = clean(query.start_date);
    const endDate = clean(query.end_date);
    if (query.project_id !== undefined && query.project_id !== "")
      find(db.projects, projectId, "项目");
    if (query.group_id !== undefined && query.group_id !== "") {
      const group = find(db.projectGroups, groupId, "分组");
      assert(
        !projectId || group.project_id === projectId,
        "分组不属于当前项目",
      );
    }
    assert(!startDate || isDate(startDate), "开始日期不合法");
    assert(!endDate || isDate(endDate), "结束日期不合法");
    assert(
      !startDate || !endDate || startDate <= endDate,
      "开始日期不能晚于结束日期",
    );
    const rows = db.answers
      .filter((a) => {
        if (a.template_id !== s.id) return false;
        const p = find(db.patients, a.user_id, "患者");
        const submittedDate = a.submitted_at.slice(0, 10);
        return (
          (!projectId || p.project_id === projectId) &&
          (!groupId || p.group_id === groupId) &&
          (!startDate || submittedDate >= startDate) &&
          (!endDate || submittedDate <= endDate)
        );
      })
      .map((a) => {
        const p = find(db.patients, a.user_id, "患者");
        const detail = answerDetail({ userId: p.id, answer: a });
        return [
          p.patient_code || `P${p.id}`,
          p.name,
          p.mobile,
          p.project_name || "未参与项目",
          p.group_name || "未入组",
          a.task_id || "历史记录",
          a.submitted_at,
          ...detail.questions.map((q) =>
            q.type === "TEXT"
              ? q.text_value
              : q.selected_options
                  .map(
                    (o) =>
                      o.label +
                      (o.input_fields.length
                        ? `（${o.input_fields.map((f) => `${f.field_label}：${f.value}`).join("；")}）`
                        : ""),
                  )
                  .join("、"),
          ),
        ];
      });
    spreadsheet(
      res,
      "survey_answers.xlsx",
      [
        "患者编号",
        "患者姓名",
        "手机号",
        "参与项目",
        "参与分组",
        "问卷轮次任务ID",
        "提交时间",
        ...s.questions.map((q) => `第${q.questionNo}题 ${q.title}`),
      ],
      rows,
      [18, 14, 16, 24, 24, 20, 20, ...s.questions.map(() => 52)],
    );
  });
  core("POST", "file/upload-file", async ({ body, res }) => {
    const file = body.get?.("file");
    assert(file && typeof file.arrayBuffer === "function", "文件不能为空");
    assert(
      ["image/jpeg", "image/png", "image/gif", "application/pdf"].includes(
        file.type,
      ),
      "仅支持 JPG、PNG、GIF 图片和 PDF 文件",
    );
    assert(file.size <= 10 * 1024 * 1024, "文件不能超过10MB");
    const id = randomUUID();
    db.files.set(id, {
      buffer: Buffer.from(await file.arrayBuffer()),
      type: file.type,
      name: file.name,
      created_at: timestamp(),
    });
    return { url: `/api/mock-files/${id}` };
  });
  route("POST", "/core/user/updateInfo", ({ body, admin }) => {
    for (const field of [
      "realname",
      "gender",
      "email",
      "phone",
      "avatar",
      "signed",
    ])
      if (field in body) admin[field] = clean(body[field]);
    admin.updated_at = timestamp();
    return userInfo(admin);
  });
  route("POST", "/core/user/modifyPassword", ({ body, admin }) => {
    assert(String(body.oldPassword || "") === admin.password, "当前密码错误");
    assert(clean(body.newPassword).length >= 6, "新密码至少6位");
    assert(body.newPassword === body.confirmPassword, "两次输入的密码不一致");
    admin.password = String(body.newPassword);
    admin.updated_at = timestamp();
    invalidateSessions(admin.id);
    return [];
  });
  route("GET", "/core/system/getLoginLogList", ({ query, admin }) =>
    legacyPage(
      descId(db.loginLogs.filter((l) => l.admin_id === admin.id)),
      query,
    ),
  );
  route("GET", "/core/system/getOperationLogList", ({ query, admin }) =>
    legacyPage(
      descId(db.operationLogs.filter((l) => l.admin_id === admin.id)),
      query,
    ),
  );
  route("GET", "/core/system/clearAllCache", () => ({ cleared: true }));
  route("GET", "/core/system/getResourceCategory", () => [
    { id: 1, value: 1, name: "资料库", label: "资料库", children: [] },
  ]);
  route("GET", "/core/system/getResourceList", ({ query: q }) =>
    legacyPage(
      [...db.files.entries()]
        .filter(
          ([, f]) =>
            f.type.startsWith("image/") &&
            (!q.object_name || f.name.includes(q.object_name)) &&
            (!q.category_id || q.category_id === "1"),
        )
        .map(([id, f]) => ({
          id,
          origin_name: f.name,
          url: `/api/mock-files/${id}`,
          size_info: `${Math.ceil(f.buffer.length / 1024)} KB`,
          category_id: 1,
          type: f.type,
          createTime: f.created_at,
        })),
      q,
    ),
  );

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const path = url.pathname;
      if (req.method === "GET" && path === "/health")
        return sendJson(res, { mode: "mock", date: today() });
      if (req.method === "POST" && path === "/app/core/logout") {
        const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
        sessions.delete(token);
        return sendJson(res, []);
      }
      if (req.method === "POST" && path === "/app/logout") {
        const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
        patientSessions.delete(token);
        return sendPatientJson(res, [], "退出成功");
      }
      if (req.method === "GET" && path.startsWith("/mock-files/")) {
        const file = db.files.get(path.slice("/mock-files/".length));
        if (!file)
          throw new ApiError("文件不存在或已失效，请重新上传", 404, 404);
        res.writeHead(200, {
          "Content-Type": file.type,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        });
        return res.end(file.buffer);
      }
      const publicCaptcha =
        req.method === "GET" &&
        ["/app/core/captcha", "/app/admin/captcha"].includes(path);
      const publicAdminLogin =
        req.method === "POST" &&
        ["/app/core/login", "/app/admin/login"].includes(path);
      const publicPatientLogin = req.method === "POST" && path === "/app/login";
      if (publicCaptcha) {
        for (const [id, expires] of captchas)
          if (expires <= clock().getTime()) captchas.delete(id);
        const uuid = randomUUID();
        captchas.set(uuid, clock().getTime() + 300000);
        const svg =
          '<svg xmlns="http://www.w3.org/2000/svg" width="140" height="46"><rect width="140" height="46" rx="5" fill="#edf5fa"/><text x="70" y="32" text-anchor="middle" font-size="28" letter-spacing="5" fill="#1d5275">1234</text></svg>';
        return sendJson(res, {
          result: 1,
          uuid,
          image: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
        });
      }
      const handler = routes.get(`${req.method} ${path}`);
      const patientHandler = patientRoutes.get(`${req.method} ${path}`);
      if (
        !publicAdminLogin &&
        !publicPatientLogin &&
        !handler &&
        !patientHandler
      )
        throw new ApiError("该功能暂不可用，请稍后重试", 404, 404);
      let admin;
      let patient;
      if (patientHandler) {
        const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
        const session = patientSessions.get(token);
        patient = db.patients.find(
          (p) =>
            p.id === session?.id &&
            p.login_enabled &&
            p.created_via === "admin",
        );
        assert(
          session && session.expires > clock().getTime() && patient,
          "登录已过期，请重新登录",
          402,
        );
        if (path !== "/app/patient/bootstrap") {
          const assignedProject = db.projects.find(
            (project) => project.id === patient.project_id,
          );
          assert(
            assignedProject &&
              effectiveProjectStatus(assignedProject, today()) !== 2,
            "项目已结束，当前无法继续使用患者端小程序",
            410,
          );
        }
      } else if (!publicAdminLogin && !publicPatientLogin) {
        const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
        const session = sessions.get(token);
        admin = db.admins.find((a) => a.id === session?.id);
        assert(
          session && session.expires > clock().getTime() && admin?.status === 1,
          "登录已过期，请重新登录",
          401,
        );
      }
      let body = {};
      if (req.method === "POST") {
        const chunks = [];
        let length = 0;
        for await (const chunk of req) {
          length += chunk.length;
          if (length > 12 * 1024 * 1024)
            throw new ApiError("请求内容过大", 413, 413);
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers["content-type"] || "";
        if (contentType.includes("multipart/form-data"))
          body = await new Request("http://localhost", {
            method: "POST",
            headers: { "Content-Type": contentType },
            body: buffer,
          }).formData();
        else if (contentType.includes("application/x-www-form-urlencoded"))
          body = Object.fromEntries(new URLSearchParams(buffer.toString()));
        else if (buffer.length) {
          try {
            body = JSON.parse(buffer.toString());
          } catch {
            throw new ApiError("请求数据格式不正确");
          }
        }
        assert(
          body && typeof body === "object" && !Array.isArray(body),
          "请求数据格式不正确",
        );
      }
      if (publicPatientLogin) {
        const mobile = clean(body.mobile);
        assert(/^1\d{10}$/.test(mobile), "请填写11位手机号");
        const patient = db.patients.find(
          (p) =>
            p.mobile === mobile && p.login_enabled && p.created_via === "admin",
        );
        assert(
          patient,
          "未查询到后台患者档案，请联系工作人员添加后再登录",
          407,
        );
        patient.last_login_at = timestamp();
        const token = randomUUID();
        patientSessions.set(token, {
          id: patient.id,
          expires: clock().getTime() + 7200000,
        });
        return sendPatientJson(
          res,
          {
            user: {
              id: patient.id,
              name: patient.name,
              mobile: patient.mobile,
              birth_date: patient.birth_date,
            },
            token: {
              token_type: "Bearer",
              access_token: token,
              refresh_token: "",
              expires_in: 7200,
            },
          },
          "登录成功",
        );
      }
      if (publicAdminLogin) {
        const expires = captchas.get(body.uuid);
        assert(
          expires &&
            expires > clock().getTime() &&
            String(body.code) === "1234",
          "验证码错误或已过期",
        );
        captchas.delete(body.uuid);
        admin = db.admins.find(
          (a) =>
            a.username === clean(body.username) &&
            a.password === String(body.password) &&
            a.status === 1,
        );
        assert(admin, "用户名或密码错误", 401);
        const token = randomUUID();
        sessions.set(token, {
          id: admin.id,
          expires: clock().getTime() + 28800000,
        });
        db.loginLogs.push({
          id: nextId(db.loginLogs),
          admin_id: admin.id,
          login_time: timestamp(),
          ip_location: "本机",
          os: "浏览器",
          ip: "127.0.0.1",
        });
        return sendJson(res, {
          token_type: "Bearer",
          expires_in: 28800,
          access_token: token,
          refresh_token: "",
        });
      }
      const context = {
        req,
        res,
        body,
        query: Object.fromEntries(url.searchParams),
        admin,
        patient,
      };
      const result = await (patientHandler || handler)(context);
      if (req.method === "POST" && admin)
        db.operationLogs.push({
          id: nextId(db.operationLogs),
          admin_id: admin.id,
          create_time: timestamp(),
          service_name: "数据操作",
          router: path,
          ip_location: "本机",
        });
      if (!res.writableEnded) {
        if (patientHandler)
          sendPatientJson(
            res,
            result ?? [],
            req.method === "POST" ? "提交成功" : "获取成功",
          );
        else
          sendJson(
            res,
            result ?? [],
            req.method === "POST" ? "操作成功" : "success",
          );
      }
    } catch (error) {
      if (!res.writableEnded) {
        res.writeHead(error.httpStatus || 200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(
          JSON.stringify({
            code: error.code || 500,
            message:
              error instanceof ApiError
                ? error.message
                : "操作失败，请检查填写内容后重试",
            data: null,
          }),
        );
      }
    }
  });
  return server;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = createMockServer();
  server.on("error", (error) => {
    console.error(`Mock 服务启动失败：${error.code || error.message}`);
    process.exitCode = 1;
  });
  server.listen(3010, "127.0.0.1", () =>
    console.log(
      "Mock API 已启动：http://127.0.0.1:3010（仅本机，数据重启清空）",
    ),
  );
}
