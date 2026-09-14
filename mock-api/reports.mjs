import { buildMockOcrResult } from "./report-ocr.mjs";

export function registerReports({
  core,
  db,
  assert,
  find,
  page,
  clean,
  isDate,
  timestamp,
  nextId,
}) {
  db.reports ||= [];
  const text = (v, label, required = true) => {
    const s = clean(v);
    assert(s.length <= 2000 && (!required || s), `请填写有效的${label}`);
    return s;
  };
  const metricFlag = (v) => {
    const flag = clean(v);
    assert(["", "偏低", "偏高", "异常"].includes(flag), "异常标识不合法");
    return flag;
  };
  const files = (values) => {
    assert(
      Array.isArray(values) && values.length > 0 && values.length <= 10,
      "请上传1至10份报告",
    );
    return values.map((url) => {
      assert(
        typeof url === "string" && url.startsWith("/api/mock-files/"),
        "报告必须为本地上传文件",
      );
      const f = db.files.get(url.slice("/api/mock-files/".length));
      assert(
        f &&
          ["image/png", "image/jpeg", "image/gif", "application/pdf"].includes(
            f.type,
          ),
        "报告文件不存在或类型不支持",
      );
      return { url, name: f.name, type: f.type };
    });
  };
  const withTask = (report) => {
    const task = report.task_id
      ? db.followupTasks.find((row) => row.id === report.task_id)
      : null;
    return {
      ...report,
      task: task
        ? {
            id: task.id,
            name: task.name,
            date: task.date,
            due_date: task.due_date,
            status: task.status,
          }
        : null,
    };
  };
  core("GET", "report/index", ({ query: q }) =>
    page(
      [...db.reports]
        .reverse()
        .filter((r) => {
          const patient = db.patients.find((p) => p.id === r.user_id);
          return (
            (!q.user_id || r.user_id === Number(q.user_id)) &&
            (!q.project_id || patient?.project_id === Number(q.project_id)) &&
            (!q.group_id || patient?.group_id === Number(q.group_id)) &&
            (!q.start_date || r.exam_date >= q.start_date) &&
            (!q.end_date || r.exam_date <= q.end_date) &&
            (!q.keyword ||
              `${r.patient_name} ${r.type}`.includes(clean(q.keyword))) &&
            (!q.status || r.status === q.status)
          );
        })
        .map(withTask),
      q,
    ),
  );
  core("GET", "report/detail", ({ query: q }) =>
    withTask(find(db.reports, q.id, "报告")),
  );
  core("POST", "report/create", ({ body: b, admin }) => {
    const p = find(db.patients, b.user_id, "患者");
    const type = text(b.type, "报告类型");
    assert(isDate(b.exam_date), "请填写检查日期");
    const documents = files(b.files);
    let task = null;
    if (b.task_id) {
      task = find(db.followupTasks, b.task_id, "任务");
      assert(
        task.user_id === p.id && task.type === "检查",
        "任务不属于该患者或不支持报告",
      );
      assert(!["已完成", "已取消"].includes(task.status), "任务已结束");
      assert(
        !db.reports.some((r) => r.task_id === task.id),
        "该任务已有报告，请进入原报告补充",
      );
    }
    const row = {
      id: nextId(db.reports),
      user_id: p.id,
      patient_name: p.name,
      type,
      exam_date: b.exam_date,
      task_id: task?.id || null,
      status: "待核对",
      ocr_status: "解析完成，待人工核对",
      ocr_result: null,
      metrics: [],
      versions: [
        {
          files: documents,
          note: clean(b.note),
          time: timestamp(),
          operator: admin.realname || admin.username,
        },
      ],
      history: [],
    };
    row.ocr_result = buildMockOcrResult({
      type,
      patient: p,
      examDate: b.exam_date,
      files: documents,
      extractedAt: timestamp(),
      sequence: row.id,
    });
    row.metrics = structuredClone(row.ocr_result.metrics);
    db.reports.push(row);
    if (task) task.status = "已提交";
    return row;
  });
  core("POST", "report/supplement", ({ body: b, admin }) => {
    const r = find(db.reports, b.id, "报告");
    assert(r.status === "需补充", "仅需补充报告可以补传");
    const documents = files(b.files),
      note = text(b.note, "补充说明");
    r.versions.push({
      files: documents,
      note,
      time: timestamp(),
      operator: admin.realname || admin.username,
    });
    const patient = find(db.patients, r.user_id, "患者");
    r.ocr_result = buildMockOcrResult({
      type: r.type,
      patient,
      examDate: r.exam_date,
      files: r.versions.flatMap((version) => version.files),
      extractedAt: timestamp(),
      sequence: r.id,
    });
    r.metrics = structuredClone(r.ocr_result.metrics);
    r.ocr_status = "解析完成，待人工核对";
    r.status = "待核对";
    if (r.task_id) {
      const t = find(db.followupTasks, r.task_id, "任务");
      if (t.status !== "已取消") t.status = "已提交";
    }
    return r;
  });
  core("POST", "report/review", ({ body: b, admin }) => {
    const r = find(db.reports, b.id, "报告");
    assert(r.status === "待核对", "报告状态已变化，请刷新");
    assert(["已核对", "需补充"].includes(b.status), "核对结果不合法");
    const reason = text(b.reason, "核对说明");
    assert(
      Array.isArray(b.metrics) && b.metrics.length <= 100,
      "指标列表不合法",
    );
    const metrics = b.metrics.map((m) => ({
      name: text(m.name, "指标名称"),
      value: text(m.value, "检测值"),
      unit: text(m.unit, "单位", false),
      reference: text(m.reference, "参考范围", false),
      flag: metricFlag(m.flag),
    }));
    const before = { status: r.status, metrics: structuredClone(r.metrics) };
    r.status = b.status;
    r.metrics = metrics;
    r.ocr_status = b.status === "已核对" ? "人工已核对" : "待补充后重新解析";
    r.history.push({
      time: timestamp(),
      operator: admin.realname || admin.username,
      reason,
      before,
      after: { status: r.status, metrics: structuredClone(metrics) },
    });
    if (r.task_id) {
      const t = find(db.followupTasks, r.task_id, "任务");
      if (t.status !== "已取消") {
        t.status = b.status === "已核对" ? "已完成" : "需补充";
        t.history.push({
          time: timestamp(),
          operator: admin.realname || admin.username,
          action: "报告核对",
          reason,
        });
      }
    }
    return r;
  });
}
