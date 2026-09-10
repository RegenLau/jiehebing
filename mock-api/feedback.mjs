export function registerFeedback({
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
}) {
  const symptoms = [
    "咳嗽",
    "咳痰",
    "发热",
    "盗汗",
    "乏力",
    "食欲下降",
    "体重下降",
    "胸闷气短",
    "其他",
  ];
  const changes = ["首次记录", "减轻", "无变化", "加重", "新出现", "消失"];
  db.feedback = db.patients
    .slice(0, 6)
    .flatMap((p, i) =>
      [0, 1, 2].map((n) => ({
        id: i * 3 + n + 1,
        user_id: p.id,
        patient_name: p.name,
        date: shiftDate(today(), -n),
        no_discomfort: n === 0 && i % 2 === 0,
        symptoms:
          n === 0 && i % 2 === 0
            ? []
            : [{ name: "咳嗽", change: changes[(i + n) % changes.length] }],
        note: "",
        source: "患者反馈",
        created_at: timestamp(),
      })),
    );
  core("GET", "feedback/index", ({ query: q }) =>
    page(
      [...db.feedback]
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
        .filter((r) => {
          const patient = db.patients.find((p) => p.id === r.user_id);
          return (
            (!q.user_id || r.user_id === Number(q.user_id)) &&
            (!q.project_id || patient?.project_id === Number(q.project_id)) &&
            (!q.group_id || patient?.group_id === Number(q.group_id)) &&
            (!q.start_date || r.date >= q.start_date) &&
            (!q.end_date || r.date <= q.end_date) &&
            (!q.keyword || r.patient_name.includes(clean(q.keyword))) &&
            (!q.date || r.date === q.date)
          );
        }),
      q,
    ),
  );
  core("POST", "feedback/record", ({ body: b, admin }) => {
    const p = find(db.patients, b.user_id, "患者");
    assert(isDate(b.date) && b.date <= today(), "反馈日期不能在未来");
    assert(
      !db.feedback.some((r) => r.user_id === p.id && r.date === b.date),
      "该患者当日已有反馈，请保留原始记录",
    );
    assert(typeof b.no_discomfort === "boolean", "请确认是否无不适");
    assert(Array.isArray(b.symptoms), "症状格式不正确");
    assert(
      b.no_discomfort ? b.symptoms.length === 0 : b.symptoms.length > 0,
      "无不适与具体症状不能同时选择",
    );
    assert(
      new Set(b.symptoms.map((s) => s.name)).size === b.symptoms.length,
      "症状不能重复",
    );
    assert(
      b.symptoms.every(
        (s) => symptoms.includes(s.name) && changes.includes(s.change),
      ),
      "请选择有效的症状和变化",
    );
    assert(!b.audio_url, "每日反馈只接收语音转成的文字，不接收原始音频");
    const note = clean(b.note);
    assert(note.length <= 2000, "补充说明过长");
    const row = {
      id: nextId(db.feedback),
      user_id: p.id,
      patient_name: p.name,
      date: b.date,
      no_discomfort: b.no_discomfort,
      symptoms: structuredClone(b.symptoms),
      note,
      source: "后台代录",
      operator: admin.realname || admin.username,
      created_at: timestamp(),
    };
    db.feedback.push(row);
    return row;
  });
}
