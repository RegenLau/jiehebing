import {
  actualTreatmentsFor,
  currentTreatmentFor,
  upcomingTreatmentFor,
} from "./patient-tasks.mjs";

const MANUAL_STATES = new Set(["暂停用药", "提前退出", "失访"]);

export function refreshPatientStudyState({ db, patient, date }) {
  if (MANUAL_STATES.has(patient.study_state)) return patient.study_state;

  const treatments = actualTreatmentsFor({ db, patient });
  const current = currentTreatmentFor({ db, patient, date });
  const upcoming = upcomingTreatmentFor({ db, patient, date });
  let nextState = patient.study_state || "待启用";

  if (
    treatments.length &&
    !current &&
    !upcoming &&
    treatments.every((row) => row.end_date && row.end_date < date)
  )
    nextState = "已完成";
  else if (
    current &&
    patient.identity_confirmed &&
    patient.medicine_confirmed
  )
    nextState = "治疗中";
  else if (!treatments.length || (!current && upcoming)) nextState = "待启用";

  patient.study_state = nextState;
  return nextState;
}
