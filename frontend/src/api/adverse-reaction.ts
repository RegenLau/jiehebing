import request from '@/utils/http'

export interface AdverseReactionRecord {
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

export interface AdverseReactionListParams {
  current: number
  size: number
  patient_name?: string
  user_id?: number
  severity?: number
}

export interface AdverseReactionListResponse {
  list: AdverseReactionRecord[]
  total: number
  current: number
  size: number
}

export function fetchAdverseReactionList(params: AdverseReactionListParams) {
  return request.get<AdverseReactionListResponse>({
    url: '/app/core/adverse-reaction/index',
    params
  })
}

export function exportAdverseReactionList(params: Omit<AdverseReactionListParams, 'current' | 'size'>) {
  return request.request<Blob>({
    url: '/app/core/adverse-reaction/export',
    method: 'GET',
    params,
    responseType: 'blob',
    showErrorMessage: false
  })
}
