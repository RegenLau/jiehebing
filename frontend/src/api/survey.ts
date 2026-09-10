import request from '@/utils/http'

export interface SurveyListParams {
  current: number
  size: number
  keyword?: string
  status?: number
}

export interface SurveyQuestionOption {
  id: number
  label: string
  sortOrder: number
  isExclusive: boolean
  triggerInput: boolean
  inputFields: Array<Record<string, any>> | null
}

export interface SurveyQuestion {
  id: number
  questionNo: number
  title: string
  type: string
  required: number
  sortOrder: number
  placeholder: string
  options: SurveyQuestionOption[]
}

export interface SurveyRecord {
  id: number
  code: string
  name: string
  description: string
  fillableDay: number
  status: number
  questionCount: number
  answerCount: number
  participantCount: number
  answerRowCount: number
  createdAt: string
}

export interface SurveyDetail extends Omit<
  SurveyRecord,
  'questionCount' | 'answerCount' | 'participantCount' | 'answerRowCount'
> {
  version?: number
  updatedAt: string
  questions: SurveyQuestion[]
}

export interface SurveyListResponse {
  list: SurveyRecord[]
  total: number
  current: number
  size: number
}

export function fetchSurveyList(params: SurveyListParams) {
  return request.get<SurveyListResponse>({
    url: '/app/core/survey/index',
    params
  })
}

export function fetchSurveyDetail(id: number) {
  return request.get<SurveyDetail>({
    url: '/app/core/survey/detail',
    params: { id }
  })
}

export function exportSurveyAnswers(id: number) {
  return request.request<Blob>({
    url: '/app/core/survey/export',
    method: 'GET',
    params: { id },
    responseType: 'blob',
    showErrorMessage: false
  })
}

export function deleteSurvey(id: number) {
  return request.post({
    url: '/app/core/survey/delete',
    params: { id },
    showSuccessMessage: true
  })
}

export function toggleSurveyStatus(id: number, status: number) {
  return request.post({
    url: '/app/core/survey/toggle-status',
    params: { id, status },
    showSuccessMessage: true
  })
}
