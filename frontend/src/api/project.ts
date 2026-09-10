import request from '@/utils/http'
export type ProjectStatus = 0 | 1 | 2
export type ResearchType = 'open' | 'single_blind' | 'double_blind'
export interface ProjectPayload {
  id?: number
  code: string
  name: string
  purpose: string
  start_date: string
  end_date: string
}
export interface Drug {
  quantity?: number
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
  treatment_days?: number
  pickup_days?: number
  advance_days?: number
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
export interface ReminderSource extends Source {
  name: string
  medication_enabled: boolean
  medication_advance_minutes: number
  task_start_enabled: boolean
  task_due_enabled: boolean
  task_overdue_enabled: boolean
  task_remind_time: string
  pickup_enabled: boolean
  pickup_advance_days: number
  pickup_remind_time: string
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
  reminder: { id: number; snapshot: ReminderSource } | null
  surveys: Schedule[]
  tasks: Schedule[]
  participant_ids: number[]
  participants?: {
    id: number
    patient_code?: string
    name: string
    mobile: string
    gender_text?: string
    birth_date?: string
    enroll_date?: string
    study_state?: string
  }[]
  created_at?: string
  updated_at?: string
}
export interface Catalog {
  medication_schemes: Source[]
  reminder_schemes: ReminderSource[]
  surveys: Source[]
  task_templates: Source[]
}
export interface ProjectRecord extends ProjectPayload {
  id: number
  status: ProjectStatus
  research_type?: ResearchType
  notes?: string
  group_count?: number
  patient_count?: number
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
    params: {
      id: group.id,
      project_id: group.project_id,
      revision: group.revision,
      name: group.name,
      description: group.description,
      medication: group.medication,
      reminder: group.reminder,
      surveys: group.surveys,
      tasks: group.tasks,
      participant_ids: group.participant_ids
    },
    showSuccessMessage: true
  })

export interface ParticipantOption {
  id: number
  name: string
  mobile: string
  is_archived: number
  group_id: number | null
  group_name: string
}
export const fetchParticipants = (project_id: number) =>
  request.get<ParticipantOption[]>({
    url: '/app/core/project/participants',
    params: { project_id }
  })
export const createGroup = (params: { project_id: number; name: string; description: string }) =>
  request.post<GroupRecord>({
    url: '/app/core/project/group-create',
    params,
    showSuccessMessage: true
  })
export const saveGroupBasic = (params: {
  id: number
  project_id: number
  revision: number
  name: string
  description: string
}) =>
  request.post<GroupRecord>({
    url: '/app/core/project/group-basic-save',
    params,
    showSuccessMessage: true
  })
