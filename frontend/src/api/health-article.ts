import request from '@/utils/http'

export interface HealthArticleRecord {
  id: number
  title: string
  cover: string
  summary: string
  content?: string
  view_count: number
  sort: number
  status: number
  published_at: string
  created_at: string
  updated_at: string
}

export interface HealthArticleListParams {
  current: number
  size: number
  keyword?: string
  status?: number
}

export interface HealthArticleListResponse {
  list: HealthArticleRecord[]
  total: number
  current: number
  size: number
}

export interface HealthArticlePayload {
  id?: number
  title: string
  cover?: string
  summary: string
  content: string
  sort: number
  status: number
  published_at?: string
}

export function fetchHealthArticleList(params: HealthArticleListParams) {
  return request.get<HealthArticleListResponse>({
    url: '/app/core/health-article/index',
    params
  })
}

export function fetchHealthArticleDetail(id: number) {
  return request.get<HealthArticleRecord>({
    url: '/app/core/health-article/detail',
    params: { id }
  })
}

export function saveHealthArticle(params: HealthArticlePayload) {
  return request.post<HealthArticleRecord>({
    url: '/app/core/health-article/save',
    params,
    showSuccessMessage: true
  })
}

export function toggleHealthArticleStatus(id: number, status: number) {
  return request.post<{ id: number; status: number }>({
    url: '/app/core/health-article/toggle-status',
    params: { id, status },
    showSuccessMessage: true
  })
}
