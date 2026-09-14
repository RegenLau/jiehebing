import request from '@/utils/http'

export interface AdverseReactionRecord {
  id: number
  user_id: number
  patient_name: string
  patient_code?: string
  patient_mobile: string
  project_id?: number | null
  project_name?: string
  group_id?: number | null
  group_name?: string
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
  processing_status?: string
  owner_id?: number
  owner_name?: string
  assessment?: { owner_id?: number; owner_name?: string }
}

export interface AdverseReactionListParams {
  current: number
  size: number
  patient_name?: string
  user_id?: number
  severity?: number
  pending?: string
  as_of?: string
  processing_status?: string
  owner_id?: number
  project_id?: number
  group_id?: number
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

export function exportAdverseReactionList(
  params: Omit<AdverseReactionListParams, 'current' | 'size'>
) {
  return request.request<Blob>({
    url: '/app/core/adverse-reaction/export',
    method: 'GET',
    params,
    responseType: 'blob',
    showErrorMessage: false
  })
}
