import request from '@/utils/http'

export type DashboardRange = 'today' | '7d' | '30d'

export interface DashboardOverview {
  range: DashboardRange
  date: string
  metrics: {
    patient_total: number
    archived_total: number
    expected_total: number
    completed_total: number
    new_adverse_total: number
  }
  login: {
    enabled: number
    disabled: number
  }
  resources: {
    survey_total: number
    article_total: number
    medicine_total: number
  }
  todos: {
    overdue_total: number
    pending_review_total: number
    pending_report_total: number
  }
  trend: {
    labels: string[]
    expected: number[]
    completed: number[]
  }
  adverse_severity: {
    mild: number
    moderate: number
    severe: number
  }
}

export function fetchDashboardOverview(
  range: DashboardRange,
  date?: string,
  scope: { project_id?: number; group_id?: number } = {}
) {
  return request.get<DashboardOverview>({
    url: '/app/core/dashboard/overview',
    params: { range, date, ...scope }
  })
}
