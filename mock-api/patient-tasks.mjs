import { buildPickupReminderTask } from "./pickup-reminder.mjs";
import { effectiveProjectStatus } from "./project-status.mjs";
import { executionSnapshotFor } from "./execution-snapshot.mjs";

const TERMINAL_STATES = new Set(["已完成", "提前退出", "失访"]);

export function treatmentStateFor(treatment, date) {
  if (!treatment) return "none";
  if (treatment.start_date > date) return "pending";
  const effectiveEnd = treatment.version_end_date || treatment.end_date;
  if (effectiveEnd && effectiveEnd < date) return "completed";
  return "current";
}

export function actualTreatmentsFor({ db, patient }) {
  return db.patientTreatments
    .filter((row) => row.user_id === patient.id && !row.superseded_before_start)
    .sort(
      (left, right) =>
        left.start_date.localeCompare(right.start_date) || left.id - right.id,
    );
}

export function currentTreatmentFor({ db, patient, date }) {
  return actualTreatmentsFor({ db, patient })
    .filter((row) => treatmentStateFor(row, date) === "current")
    .at(-1);
}

export function upcomingTreatmentFor({ db, patient, date }) {
  return actualTreatmentsFor({ db, patient }).find(
    (row) => treatmentStateFor(row, date) === "pending",
  );
}

export function latestTreatmentFor({ db, patient, shiftDate, date }) {
  const actuals = actualTreatmentsFor({ db, patient });
  const actual =
    actuals.filter((row) => treatmentStateFor(row, date) === "current").at(-1) ||
    actuals.find((row) => treatmentStateFor(row, date) === "pending") ||
    actuals.at(-1);
  if (actual) return actual;

  const medicines = db.medicines.filter((row) => row.user_id === patient.id);
  if (!medicines.length) return null;
  const group = db.projectGroups.find((row) => row.id === patient.group_id);
  const execution = executionSnapshotFor(db, patient);
  const medication = execution?.medication || group?.medication;
  const treatmentDays = medication?.treatment_days || 0;
  return {
    id: `legacy-${patient.id}`,
    user_id: patient.id,
    source_group_id: patient.group_id,
    source_revision: execution?.group_revision || group?.revision || 1,
    source_scheme: structuredClone(medication || null),
    schedule_snapshot: execution ? structuredClone(execution) : null,
    adjusted: false,
    adjustment_summary: [],
    start_date: patient.enroll_date,
    end_date: treatmentDays
      ? shiftDate(patient.enroll_date, treatmentDays - 1)
      : "",
    treatment_days: treatmentDays,
    drugs: medicines.map((medicine) => ({
      drug_id: medicine.common_medicine_id,
      name: medicine.name,
      specification: medicine.specification,
      dose: Number(medicine.dosage_value),
      unit: medicine.dosage_unit,
      times: medicine.plan_times,
      frequency: `每日${medicine.frequency}次`,
      precautions: medicine.medication_guidance,
    })),
    created_at: medicines[0].created_at,
    reason: "研究分组初始用药安排",
    legacy: true,
  };
}

function scheduledTasks({ db, patient, treatment, currentDate, shiftDate }) {
  const group = db.projectGroups.find((row) => row.id === patient.group_id);
  if (!group || !treatment) return [];
  const schedule =
    treatment.schedule_snapshot || executionSnapshotFor(db, patient) || group;
  const result = [];
  for (const [kind, type, bindings] of [
    ["surveys", "问卷", schedule.surveys || []],
    ["tasks", null, schedule.tasks || []],
  ])
    for (const binding of bindings) {
      const anchor =
        binding.anchor === "date"
          ? binding.date
          : binding.anchor === "treatment"
            ? treatment.start_date
            : patient.enroll_date;
      let date = shiftDate(anchor, binding.offset_days);
      let iterations = 0;
      while (date <= treatment.end_date && iterations++ < 4000) {
        const dueDate = shiftDate(date, binding.deadline_days - 1);
        if (date >= treatment.start_date && dueDate >= currentDate) {
          result.push({
            id: `scheduled-${kind}-${binding.id}-${date}`,
            binding_kind: kind,
            binding_id: binding.id,
            snapshot: structuredClone(binding),
            name: binding.snapshot.name,
            type: type || binding.snapshot.type,
            date,
            due_date: dueDate,
            remind_time: binding.remind_time || "",
            description: binding.snapshot.description || "",
            requirements: binding.snapshot.requirements || "",
            status: "待完成",
            source: "分组安排",
            virtual: true,
          });
        }
        if (!binding.interval_days) break;
        date = shiftDate(date, binding.interval_days);
      }
    }
  return result;
}

function enrichTask(row, patient, currentDate) {
  return {
    ...row,
    user_id: row.user_id ?? patient.id,
    patient_name: row.patient_name || patient.name,
    project_id: row.project_id ?? patient.project_id ?? null,
    group_id: row.group_id ?? patient.group_id ?? null,
    remind_time: row.remind_time || row.snapshot?.remind_time || "",
    overdue: row.due_date < currentDate,
    form: row.type === "问卷" ? row.snapshot?.snapshot || null : null,
  };
}

function isTaskReleased(row, currentDateTime) {
  if (row.status === "需补充") return true;
  const remindTime = row.remind_time || row.snapshot?.remind_time || "00:00";
  const effectiveTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(remindTime)
    ? remindTime
    : "00:00";
  return `${row.date} ${effectiveTime}` <= currentDateTime;
}

export function buildPatientTaskSummary({
  db,
  patient,
  treatment,
  today,
  shiftDate,
  timestamp,
  includeFuture = false,
}) {
  const currentDate = today();
  const currentDateTime = includeFuture ? "" : timestamp().slice(0, 16);
  const visibleThrough = shiftDate(currentDate, 14);
  const actual = db.followupTasks
    .filter(
      (row) =>
        row.user_id === patient.id &&
        ["待完成", "需补充"].includes(row.status) &&
        (row.status === "需补充" || row.date <= visibleThrough),
    )
    .map((row) => ({ ...row, virtual: false }));
  const actualSchedules = new Set(
    db.followupTasks
      .filter((row) => row.user_id === patient.id)
      .map(
        (row) =>
          `${row.binding_kind || ""}-${row.binding_id || ""}-${row.date}`,
      ),
  );
  const planned = scheduledTasks({
    db,
    patient,
    treatment,
    currentDate,
    shiftDate,
  }).filter(
    (row) =>
      row.date <= visibleThrough &&
      !actualSchedules.has(`${row.binding_kind}-${row.binding_id}-${row.date}`),
  );
  const feedbackDone = db.feedback.some(
    (row) => row.user_id === patient.id && row.date === currentDate,
  );
  const feedback = feedbackDone
    ? []
    : [
        {
          id: `daily-feedback-${currentDate}`,
          name: "每日健康反馈",
          type: "健康反馈",
          date: currentDate,
          due_date: currentDate,
          remind_time: "",
          description: "记录今天是否有身体不适或症状变化",
          requirements: "提交有无不适、症状变化和补充说明",
          status: "待完成",
          source: "每日任务",
          virtual: true,
        },
      ];
  const pickupReminder = buildPickupReminderTask({
    db,
    patient,
    treatment,
    today,
    shiftDate,
    visibleThrough,
  });
  return [
    ...feedback,
    ...(pickupReminder ? [pickupReminder] : []),
    ...actual,
    ...planned,
  ]
    .sort(
      (left, right) =>
        left.due_date.localeCompare(right.due_date) ||
        left.date.localeCompare(right.date),
    )
    .map((row) => enrichTask(row, patient, currentDate))
    .filter((row) => includeFuture || isTaskReleased(row, currentDateTime));
}

function assignedTasks({ db, patient, currentDate }) {
  return db.followupTasks
    .filter(
      (row) =>
        row.user_id === patient.id && ["待完成", "需补充"].includes(row.status),
    )
    .sort((left, right) => right.id - left.id)
    .map((row) => enrichTask({ ...row, virtual: false }, patient, currentDate));
}

export function buildPatientTasks({
  db,
  patient,
  today,
  shiftDate,
  timestamp,
  includeFuture = false,
}) {
  const currentDate = today();
  if (TERMINAL_STATES.has(patient.study_state))
    return db.followupTasks
      .filter(
        (row) =>
          row.user_id === patient.id &&
          row.safety_followup === true &&
          ["待完成", "需补充"].includes(row.status),
      )
      .map((row) => enrichTask({ ...row, virtual: false }, patient, currentDate))
      .sort(
        (left, right) =>
          left.due_date.localeCompare(right.due_date) ||
          left.date.localeCompare(right.date),
      );
  const currentDateTime = includeFuture ? "" : timestamp().slice(0, 16);
  const treatment = latestTreatmentFor({
    db,
    patient,
    shiftDate,
    date: today(),
  });
  const summary = buildPatientTaskSummary({
    db,
    patient,
    treatment,
    today,
    shiftDate,
    timestamp,
    includeFuture,
  });
  const summaryIds = new Set(summary.map((row) => String(row.id)));
  return [
    ...summary,
    ...assignedTasks({ db, patient, currentDate }).filter(
      (row) => !summaryIds.has(String(row.id)),
    ),
  ]
    .filter((row) => includeFuture || isTaskReleased(row, currentDateTime))
    .sort(
      (left, right) =>
        left.due_date.localeCompare(right.due_date) ||
        left.date.localeCompare(right.date) ||
        String(left.id).localeCompare(String(right.id)),
    );
}

export function buildManagedPatientTasks({ db, today, shiftDate, timestamp }) {
  const currentDate = today();
  const activeProjectIds = new Set(
    db.projects
      .filter((project) => effectiveProjectStatus(project, currentDate) !== 2)
      .map((project) => project.id),
  );
  return db.patients
    .filter((patient) => activeProjectIds.has(patient.project_id))
    .flatMap((patient) =>
      buildPatientTasks({
        db,
        patient,
        today,
        shiftDate,
        timestamp,
        includeFuture: true,
      }),
    )
    .sort(
      (left, right) =>
        left.due_date.localeCompare(right.due_date) ||
        left.date.localeCompare(right.date) ||
        left.patient_name.localeCompare(right.patient_name, "zh-CN") ||
        String(left.id).localeCompare(String(right.id)),
    );
}
