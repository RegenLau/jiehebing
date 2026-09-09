import request from '@/utils/http'

export interface CommonMedicineRecord {
  id: number
  common_name: string
  company: string
  specification: string
  ybm: string
  usage: string
  frequency: number
  dosage: string
  dosage_value: string
  dosage_unit: string
  medication_guidance: string
  thumb: string
  sort_order: number
  status: number
  status_text: string
  created_at: string
  updated_at: string
}

export interface CommonMedicineListParams {
  current: number
  size: number
  keyword?: string
  status?: number
}

export interface CommonMedicineListResponse {
  list: CommonMedicineRecord[]
  total: number
  current: number
  size: number
}

export function fetchCommonMedicineList(params: CommonMedicineListParams) {
  return request.get<CommonMedicineListResponse>({
    url: '/app/core/common-medicine/index',
    params
  })
}

export function toggleCommonMedicineStatus(id: number, status: number) {
  return request.post<{ id: number; status: number }>({
    url: '/app/core/common-medicine/toggle-status',
    params: { id, status },
    showSuccessMessage: true
  })
}
