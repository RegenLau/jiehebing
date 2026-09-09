import request from '@/utils/http'
export type ProjectStatus = 0 | 1 | 2
export type ResearchType = 'open' | 'single_blind' | 'double_blind'
export interface ProjectPayload {
  id?: number
  code: string
  name: string
  purpose: string
  notes: string
  start_date: string
  end_date: string
  research_type: ResearchType
}
export interface Drug {
  drug_id: number
  name: string
  specification: string
  dose: string
  unit: string
  frequency: string
  times: string
  precautions: string
}
export interface Source {
  id: number
  name?: string
  title?: string
  description?: string
  summary?: string
  status: number
  version?: string
  drugs?: Drug[]
  questions?: { id: number; title: string; options: { label: string }[] }[]
  requirements?: string
}
export interface Binding {
  id: number
  snapshot: Source
}
export interface Schedule extends Binding {
  anchor: 'enrollment' | 'treatment' | 'date'
  date: string
  offset_days: number
  interval_days: number
  deadline_days: number
  reminders: { start: boolean; due: boolean; overdue: boolean }
}
export interface Medication extends Binding {
  treatment_days: number
  pickup_days: number
  advance_days: number
  quantities: { drug_id: number; quantity: number }[]
}
export interface GroupRecord {
  id?: number
  project_id: number
  revision?: number
  name: string
  description: string
  medication: Medication | null
  surveys: Schedule[]
  tasks: Schedule[]
  articles: Binding[]
  contact_ids: number[]
  created_at?: string
  updated_at?: string
}
export interface Catalog {
  medication_schemes: Source[]
  surveys: Source[]
  task_templates: Source[]
  articles: Source[]
  contacts: Source[]
}
export interface ProjectRecord extends ProjectPayload {
  id: number
  status: ProjectStatus
  group_count?: number
  groups?: GroupRecord[]
  created_at: string
  updated_at: string
  history: {
    action: string
    operator: string
    time: string
    note: string
    changes?: { field: string; before: unknown; after: unknown }[]
  }[]
}
export const fetchProjectList = (params: {
  current: number
  size: number
  keyword?: string
  status?: ProjectStatus
}) =>
  request.get<{ list: ProjectRecord[]; total: number }>({ url: '/app/core/project/index', params })
export const fetchProjectDetail = (id: number) =>
  request.get<ProjectRecord>({ url: '/app/core/project/detail', params: { id } })
export const saveProject = (params: ProjectPayload) =>
  request.post<ProjectRecord>({ url: '/app/core/project/save', params, showSuccessMessage: true })
export const changeProjectStatus = (
  id: number,
  status: ProjectStatus,
  reason: string,
  expected_status: ProjectStatus
) =>
  request.post<ProjectRecord>({
    url: '/app/core/project/change-status',
    params: { id, status, reason, expected_status },
    showSuccessMessage: true
  })
export const fetchProjectCatalog = () => request.get<Catalog>({ url: '/app/core/project/catalog' })
export const fetchGroupDetail = (project_id: number, id: number) =>
  request.get<GroupRecord>({ url: '/app/core/project/group-detail', params: { project_id, id } })
export const saveGroup = (group: GroupRecord) =>
  request.post<GroupRecord>({
    url: '/app/core/project/group-save',
    params: { ...group, article_ids: group.articles.map((a) => a.id) },
    showSuccessMessage: true
  })
