import { calculatePatientStock } from "./pickup-reminder.mjs";

export function registerMedicationRecords({
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
}) {
  db.stockAdjustments = [];
  core("POST", "medication-plan/record", ({ body: b, admin }) => {
    const row = find(db.plans, b.id, "服药计划");
    assert(row.status !== 3, "已取消或暂停计划不能登记");
    assert([1, 2].includes(b.status), "请选择已服或明确未服");
    assert(row.plan_date <= today(), "不能登记未来服药结果");
    const reason = clean(b.reason);
    assert(reason && reason.length <= 1000, "请填写患者反馈来源与说明");
    row.record_history ||= [];
    row.record_history.push({
      time: timestamp(),
      operator: admin.realname || admin.username,
      before: { status: row.status, checked_at: row.checked_at },
      after: { status: b.status },
      reason,
    });
    row.status = b.status;
    row.status_text = b.status === 1 ? "已服（人工登记）" : "明确未服";
    row.checked_at = b.status === 1 ? timestamp() : "";
    row.record_reason = reason;
    return row;
  });
  core("POST", "medication-plan/contact", ({ body: b, admin }) => {
    const row = find(db.plans, b.id, "服药计划");
    assert(clean(b.reason), "请填写联系结果");
    row.contacts ||= [];
    row.contacts.unshift({
      time: timestamp(),
      operator: admin.realname || admin.username,
      reason: clean(b.reason),
    });
    return row;
  });
  core("GET", "patient/stock", ({ query: q }) => {
    const patient = find(db.patients, q.user_id, "患者");
    const treatment = db.patientTreatments
      .filter((row) => row.user_id === patient.id)
      .at(-1);
    return calculatePatientStock({ db, patient, treatment, today, shiftDate });
  });
  core("POST", "patient/stock-adjust", ({ body: b, admin }) => {
    const patient = find(db.patients, b.user_id, "患者");
    const treatment = db.patientTreatments
      .filter((row) => row.user_id === patient.id)
      .at(-1);
    assert(
      treatment?.drugs.some((drug) => drug.drug_id === b.drug_id),
      "药品不属于当前个体方案",
    );
    assert(
      isDate(b.date) && b.date < today(),
      "请登记昨日或更早的日终盘点日期",
    );
    assert(
      typeof b.quantity === "number" &&
        Number.isFinite(b.quantity) &&
        b.quantity >= 0,
      "盘点数量不合法",
    );
    assert(clean(b.reason), "请填写盘点修正原因");
    const row = {
      id: nextId(db.stockAdjustments),
      user_id: patient.id,
      drug_id: b.drug_id,
      date: b.date,
      quantity: b.quantity,
      reason: clean(b.reason),
      operator: admin.realname || admin.username,
      time: timestamp(),
    };
    db.stockAdjustments.push(row);
    return row;
  });
}
