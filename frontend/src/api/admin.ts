import request from '@/utils/http'

export interface AdminRecord {
  id: number
  username: string
  phone: string
  email: string
  avatar: string
  status: number
  created_at: string
  updated_at: string
}

export interface AdminPayload {
  id?: number
  username: string
  password?: string
  phone?: string
  email?: string
  avatar?: string
  status: number
}

export function fetchAdminList() {
  return request.get<AdminRecord[]>({
    url: '/app/core/admin/index'
  })
}

export function createAdmin(params: AdminPayload) {
  return request.post<AdminRecord>({
    url: '/app/core/admin/save',
    params,
    showSuccessMessage: true
  })
}

export function updateAdmin(params: AdminPayload) {
  return request.post<AdminRecord>({
    url: '/app/core/admin/update',
    params,
    showSuccessMessage: true
  })
}
