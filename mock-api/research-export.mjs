export function registerResearchExport({
  core,
  db,
  assert,
  clean,
  today,
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
        "患者端登录",
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
          p.login_enabled ? "可登录" : "不可登录",
        ]);
    } else if (q.kind === "tasks") {
      headers = [
        "任务ID",
        "轮次标识",
        "患者",
        "研究",
        "分组",
        "任务",
        "类型",
        "开始日期",
        "截止日期",
        "状态",
        "来源",
        "说明",
        "结果",
      ];
      rows = db.followupTasks
        .filter((r) => {
          const p = patientFor(r.user_id);
          return (
            (!user_id || r.user_id === user_id) &&
            inScope(p, q, r.date) &&
            (!keyword || `${r.name} ${r.patient_name}`.includes(keyword)) &&
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
            r.patient_name,
            p?.project_name || "",
            p?.group_name || "",
            r.name,
            r.type,
            r.date,
            r.due_date,
            r.status,
            r.source,
            r.description,
            r.result || "",
          ];
        });
    } else if (q.kind === "reports") {
      headers = [
        "报告ID",
        "患者",
        "研究",
        "分组",
        "类型",
        "检查日期",
        "关联任务",
        "状态",
        "上传次数",
        "核对指标",
      ];
      rows = db.reports
        .filter((r) => {
          const p = patientFor(r.user_id);
          return (
            (!user_id || r.user_id === user_id) &&
            inScope(p, q, r.exam_date) &&
            (!keyword || `${r.patient_name} ${r.type}`.includes(keyword)) &&
            (!q.status || r.status === q.status)
          );
        })
        .map((r) => {
          const p = patientFor(r.user_id);
          return [
            r.id,
            r.patient_name,
            p?.project_name || "",
            p?.group_name || "",
            r.type,
            r.exam_date,
            r.task_id || "",
            r.status,
            r.versions.length,
            r.metrics
              .map(
                (m) =>
                  `${m.name}：${m.value}${m.unit}（${m.reference}${m.flag ? `，${m.flag}` : ""}）`,
              )
              .join("；"),
          ];
        });
    } else if (q.kind === "feedback") {
      headers = [
        "患者",
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
            (!keyword || r.patient_name.includes(keyword)) &&
            (!q.date || r.date === q.date)
          );
        })
        .map((r) => {
          const p = patientFor(r.user_id);
          return [
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
        "患者",
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
          return (
            (!user_id || r.user_id === user_id) &&
            inScope(p, q, r.plan_date) &&
            (!keyword || `${r.patient_name} ${r.name}`.includes(keyword)) &&
            (!q.status || String(r.status) === String(q.status))
          );
        })
        .map((r) => {
          const p = patientFor(r.user_id);
          return [
            r.id,
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
