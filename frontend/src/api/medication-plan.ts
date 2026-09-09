import request from '@/utils/http'

export interface MedicationPlanRecord {
  id: number
  user_id: number
  medicine_id: number
  patient_name: string
  patient_mobile: string
  batch_no: string
  plan_date: string
  day_number: number
  plan_time: string
  plan_index: number
  name: string
  specification: string
  usage: string
  frequency: number
  dosage: string
  dosage_value: string
  dosage_unit: string
  status: number
  status_text: string
  checked_at: string
  created_at: string
}

export interface MedicationPlanListParams {
  current: number
  size: number
  patient_name?: string
  plan_date?: string
  user_id?: number
  scope?: 'today' | 'all'
  status?: 0 | 1 | 2 | 3
  overdue?: boolean
  overdue_range?: '7d' | '30d'
  as_of?: string
}

export interface MedicationPlanListResponse {
  list: MedicationPlanRecord[]
  total: number
  current: number
  size: number
  scope: 'today' | 'all'
}

export function fetchMedicationPlanList(params: MedicationPlanListParams) {
  return request.get<MedicationPlanListResponse>({
    url: '/app/core/medication-plan/index',
    params
  })
}
