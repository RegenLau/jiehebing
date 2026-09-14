import { buildManagedPatientTasks } from "./patient-tasks.mjs";

export function registerResearchExport({
  core,
  db,
  assert,
  clean,
  today,
  shiftDate,
  spreadsheet,
}) {
  const patientFor = (userId) =>
    db.patients.find((patient) => patient.id === userId);
  const inScope = (patient, query, dateValue) =>
    Boolean(patient) &&
    (!query.project_id || patient.project_id === Number(query.project_id)) &&
    (!query.group_id || patient.group_id === Number(query.group_id)) &&
    (!query.start_date || dateValue >= query.start_date) &&
    (!query.end_date || dateValue <= query.end_date);
  core("GET", "research/export", ({ query: q, res }) => {
    let headers, rows;
    const keyword = clean(q.keyword),
      user_id = Number(q.user_id) || 0;
    if (q.kind === "patients") {
      headers = [
        "患者编号",
        "姓名",
        "手机号",
        "性别",
        "出生日期",
        "研究",
        "研究分组",
        "研究状态",
        "入组日期",
      ];
      rows = db.patients
        .filter(
          (p) =>
            inScope(p, q, p.enroll_date) &&
            (!keyword ||
              `${p.name} ${p.mobile} ${p.patient_code || ""}`.includes(
                keyword,
              )) &&
            (!q.study_state || (p.study_state || "待启用") === q.study_state),
        )
        .map((p) => [
          p.patient_code || p.id,
          p.name,
          p.mobile,
          p.gender_text,
          p.birth_date,
          p.project_name || "",
          p.group_name || "",
          p.study_state || "待启用",
          p.enroll_date,
        ]);
    } else if (q.kind === "tasks") {
      headers = [
        "任务ID",
        "轮次标识",
        "患者编号",
        "患者姓名",
        "研究",
        "分组",
        "任务",
        "类型",
        "报告类型",
        "开始日期",
        "截止日期",
        "提醒时间",
        "状态",
        "来源",
        "说明",
        "结果",
      ];
      rows = buildManagedPatientTasks({ db, today, shiftDate })
        .filter((r) => {
          const p = patientFor(r.user_id);
          return (
            (!user_id || r.user_id === user_id) &&
            inScope(p, q, r.date) &&
            (!keyword || `${r.name} ${r.patient_name} ${p?.patient_code || ""}`.includes(keyword)) &&
            (!q.type || r.type === q.type) &&
            (!q.status || r.status === q.status) &&
            (q.overdue !== "1" ||
              (r.due_date < today() &&
                !["已完成", "已取消"].includes(r.status)))
          );
        })
        .map((r) => {
          const p = patientFor(r.user_id),
            round = r.binding_id
              ? `${r.binding_kind}-${r.binding_id}-${r.date}`
              : `temporary-${r.id}`;
          return [
            r.id,
            round,
            p?.patient_code || `P${r.user_id}`,
            r.patient_name,
            p?.project_name || "",
            p?.group_name || "",
            r.name,
            r.type,
            r.report_type || "",
            r.date,
            r.due_date,
            r.remind_time || "",
            r.status,
            r.source,
            r.description,
            r.result || "",
          ];
        });
    } else if (q.kind === "reports") {
      headers = [
        "报告ID",
        "患者编号",
        "患者姓名",
        "研究",
        "分组",
        "类型",
        "检查日期",
        "关联任务",
        "状态",
        "上传次数",
        "OCR原始识别值",
        "人工核对值",
        "核对人",
        "核对时间",
      ];
      rows = db.reports
        .filter((r) => {
          const p = patientFor(r.user_id);
          return (
            (!user_id || r.user_id === user_id) &&
            inScope(p, q, r.exam_date) &&
            (!keyword || `${r.patient_name} ${p?.patient_code || ""} ${r.type}`.includes(keyword)) &&
            (!q.status || r.status === q.status)
          );
        })
        .map((r) => {
          const p = patientFor(r.user_id);
          const latestReview = r.history?.at(-1);
          const metricText = (metrics) =>
            (metrics || [])
              .map(
                (m) =>
                  `${m.name}：${m.value}${m.unit}（${m.reference}${m.flag ? `，${m.flag}` : ""}）`,
              )
              .join("；");
          return [
            r.id,
            p?.patient_code || `P${r.user_id}`,
            r.patient_name,
            p?.project_name || "",
            p?.group_name || "",
            r.type,
            r.exam_date,
            r.task_id || "",
            r.status,
            r.versions.length,
            metricText(r.ocr_result?.metrics),
            r.status === "已核对" ? metricText(r.metrics) : "待人工核对",
            r.status === "已核对" ? latestReview?.operator || "" : "",
            r.status === "已核对" ? latestReview?.time || "" : "",
          ];
        });
    } else if (q.kind === "feedback") {
      headers = [
        "反馈记录ID",
        "患者编号",
        "患者姓名",
        "研究",
        "分组",
        "日期",
        "症状变化",
        "补充说明",
        "来源",
      ];
      rows = db.feedback
        .filter((r) => {
          const p = patientFor(r.user_id);
          return (
            (!user_id || r.user_id === user_id) &&
            inScope(p, q, r.date) &&
            (!keyword || `${r.patient_name} ${p?.patient_code || ""}`.includes(keyword)) &&
            (!q.date || r.date === q.date)
          );
        })
        .map((r) => {
          const p = patientFor(r.user_id);
          return [
            r.id,
            p?.patient_code || `P${r.user_id}`,
            r.patient_name,
            p?.project_name || "",
            p?.group_name || "",
            r.date,
            r.no_discomfort
              ? "无不适"
              : r.symptoms.map((s) => `${s.name}：${s.change}`).join("；"),
            r.note,
            r.source,
          ];
        });
    } else if (q.kind === "medications") {
      headers = [
        "计划ID",
        "患者编号",
        "患者姓名",
        "研究",
        "分组",
        "计划日期",
        "服药时间",
        "药品",
        "规格",
        "剂量",
        "状态",
        "记录说明",
        "打卡时间",
      ];
      rows = db.plans
        .filter((r) => {
          const p = patientFor(r.user_id);
          const asOf = /^\d{4}-\d{2}-\d{2}$/.test(q.as_of || "")
            ? q.as_of
            : today();
          const overdueStart = q.overdue_range === "7d"
            ? shiftDate(asOf, -6)
            : q.overdue_range === "30d"
              ? shiftDate(asOf, -29)
              : "";
          return (
            (!user_id || r.user_id === user_id) &&
            inScope(p, q, r.plan_date) &&
            (!keyword || `${r.patient_name} ${p?.patient_code || ""} ${r.name}`.includes(keyword)) &&
            (q.status === undefined ||
              q.status === "" ||
              String(r.status) === String(q.status)) &&
            (q.scope !== "today" || r.plan_date === today()) &&
            (!q.plan_date || r.plan_date === q.plan_date) &&
            (q.overdue !== "1" ||
              (r.status === 0 &&
                r.plan_date < asOf &&
                (!overdueStart || r.plan_date >= overdueStart)))
          );
        })
        .map((r) => {
          const p = patientFor(r.user_id);
          return [
            r.id,
            p?.patient_code || `P${r.user_id}`,
            r.patient_name,
            p?.project_name || "",
            p?.group_name || "",
            r.plan_date,
            r.plan_time,
            r.name,
            r.specification,
            r.dosage,
            r.status_text,
            r.record_reason || "",
            r.checked_at || "",
          ];
        });
    } else assert(false, "导出类型不支持");
    spreadsheet(res, `${q.kind}.xlsx`, headers, rows);
  });
}
