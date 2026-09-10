import request from '@/utils/http'

export interface PatientRecord {
  id: number
  name: string
  mobile: string
  gender: number
  gender_text: string
  birth_date: string
  age: number
  is_archived: number
  login_enabled: boolean
  created_via: string
  project_id?: number
  project_name?: string
  group_id?: number
  group_name?: string
  medication_scheme_id?: number
  medication_scheme_name?: string
  study_state?: string
  arrangement_ready?: boolean
  arrangement_type?: '待确认方案' | '分组方案' | '个体调整'
  enroll_date: string
  status: number
  created_at: string
  updated_at: string
}

export interface PatientListParams {
  keyword?: string
  study_state?: string
  project_id?: number
  group_id?: number
  start_date?: string
  end_date?: string
  current: number
  size: number
}

export interface PatientListResponse {
  list: PatientRecord[]
  total: number
  current: number
  size: number
}

export interface PatientSurveyStatusRecord {
  template_id: number
  code: string
  name: string
  description: string
  fillable_day: number
  fillable_date: string | null
  fillable: boolean
  answered: boolean
  submitted_at: string
  answer_count: number
}

export interface PatientMedicineRecord {
  id: number
  name: string
  specification: string
  usage: string
  frequency: number
  dosage: string
  dosage_value: string
  dosage_unit: string
  remark: string
  trade_name: string
  company: string
  medicine_count: string
  ybm: string
  thumb: string
  batch_no: string
  sort: number
  source: string
  source_text: string
  medication_guidance: string
  created_at: string
  updated_at: string
}

export interface PatientMedicineListResponse {
  list: PatientMedicineRecord[]
  total: number
  current: number
  size: number
}

export interface PatientSurveyAnswerDetail {
  template: {
    id: number
    code: string
    name: string
    description: string
    fillable_day: number
  }
  submitted_at: string
  questions: Array<{
    question_id: number
    question_no: number
    title: string
    type: string
    required: boolean
    placeholder: string
    answered: boolean
    text_value: string
    answer_summary: string
    selected_options: Array<{
      id: number
      label: string
      is_exclusive: boolean
      trigger_input: boolean
      input_fields: Array<{
        field_key: string
        field_label: string
        value: string
      }>
    }>
  }>
}

export interface PatientAdverseReactionRecord {
  id: number
  user_id: number
  patient_name: string
  patient_mobile: string
  occurred_at: string
  symptoms: string[]
  symptom_summary: string
  symptom_description: string
  severity: number
  severity_text: string
  advice_text: string
  status: number
  status_text: string
  created_at: string
}

export interface PatientAdverseReactionListResponse {
  list: PatientAdverseReactionRecord[]
  total: number
  current: number
  size: number
}

export function fetchPatientList(params: PatientListParams) {
  return request.get<PatientListResponse>({
    url: '/app/core/patient/index',
    params
  })
}

export function fetchPatientDetail(user_id: number) {
  return request.get<PatientRecord>({
    url: '/app/core/patient/detail',
    params: { user_id }
  })
}

export function fetchPatientMedicineList(user_id: number, current: number, size: number) {
  return request.get<PatientMedicineListResponse>({
    url: '/app/core/patient/medicine-list',
    params: { user_id, current, size }
  })
}

export function fetchPatientSurveyStatus(user_id: number) {
  return request.get<PatientSurveyStatusRecord[]>({
    url: '/app/core/patient/survey-status',
    params: { user_id }
  })
}

export function fetchPatientSurveyAnswerDetail(user_id: number, template_id: number) {
  return request.get<PatientSurveyAnswerDetail>({
    url: '/app/core/patient/survey-answer-detail',
    params: { user_id, template_id }
  })
}

export function fetchPatientAdverseReactionList(user_id: number, current: number, size: number) {
  return request.get<PatientAdverseReactionListResponse>({
    url: '/app/core/adverse-reaction/index',
    params: { user_id, current, size }
  })
}
