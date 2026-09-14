<template>
  <div class="page" :class="{ embedded }">
    <div class="page-header">
      <div v-if="!embedded">
        <h2>检查报告</h2>
        <p>查看报告原件、OCR 结构化数据及人工核对结果</p>
      </div>
      <div class="header-actions">
        <ResearchExport
          kind="reports"
          :params="{
            keyword,
            status: status || route.query.status,
            user_id: effectiveUserId || undefined,
            project_id: projectId,
            group_id: groupId,
            start_date: dateRange[0],
            end_date: dateRange[1]
          }"
        />
        <ElButton type="primary" @click="create">代录报告</ElButton>
      </div>
    </div>

    <ElCard class="list-card" shadow="never">
      <div class="filter-panel" :class="{ 'filter-panel--embedded': embedded }">
        <div v-if="!embedded" class="filter-block filter-block--scope">
          <span class="filter-label">研究范围</span>
          <ResearchScopeFilter
            date-label="检查日期"
            v-model:project-id="projectId"
            v-model:group-id="groupId"
            v-model:date-range="dateRange"
            @change="search"
          />
        </div>
        <div class="filter-block filter-block--query">
          <label v-if="!embedded" class="filter-field filter-field--keyword">
            <span>关键字</span>
            <ElInput
              v-model="keyword"
              placeholder="患者姓名、编号或报告类型"
              clearable
              @clear="search"
              @keyup.enter="search"
            />
          </label>
          <label class="filter-field filter-field--status">
            <span>报告状态</span>
            <ElSelect v-model="status" placeholder="全部状态" clearable @change="search">
              <ElOption
                v-for="item in ['待核对', '需补充', '已核对']"
                :key="item"
                :label="item"
                :value="item"
              />
            </ElSelect>
          </label>
          <ElButton class="search-button" type="primary" plain @click="search">查询</ElButton>
        </div>
      </div>

      <ElTable v-loading="loading" :data="rows" border>
        <ElTableColumn label="患者" min-width="180">
          <template #default="{ row }">
            <strong>{{ row.patient_name }}</strong>
            <small class="patient-code">{{ row.patient_code }}</small>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="type" label="报告类型" min-width="140" />
        <ElTableColumn label="关联任务" min-width="190">
          <template #default="{ row }">
            <div v-if="row.task" class="related-task">
              <span>{{ row.task.name }}</span>
              <small>{{ row.task.date }}</small>
            </div>
            <span v-else class="muted-text">未关联</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="exam_date" label="检查日期" min-width="120" />
        <ElTableColumn label="OCR 数据" min-width="120">
          <template #default="{ row }">
            <span v-if="row.ocr_result?.summary">{{ row.ocr_result.summary.field_count }} 项</span>
            <span v-else class="muted-text">待解析</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="状态" min-width="110">
          <template #default="{ row }">
            <ElTag :type="statusTagType(row.status)" effect="light">{{ row.status }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="open(row.id)">查看详情</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
      <ElPagination
        v-model:current-page="current"
        :page-size="10"
        :total="total"
        layout="total,prev,pager,next"
        @current-change="load"
      />
    </ElCard>

    <ElDialog
      v-model="createVisible"
      title="代录报告"
      width="760px"
      append-to-body
      :before-close="closeCreate"
      :close-on-click-modal="false"
    >
      <ElForm class="create-form" label-position="top" :disabled="saving">
        <ElAlert
          title="上传后将自动生成本地 Mock OCR 结构化数据，提交前请与原文件逐项核对。"
          type="info"
          :closable="false"
          show-icon
        />
        <div class="create-grid">
          <ElFormItem label="患者">
            <ElSelect
              v-model="form.user_id"
              filterable
              :disabled="Boolean(effectiveUserId)"
              @change="patientChanged"
            >
              <ElOption
                v-for="patient in patients"
                :key="patient.id"
                :label="patient.name + ' · ' + patient.mobile"
                :value="patient.id"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="关联任务（可选）">
            <ElSelect v-model="form.task_id" clearable @change="taskChanged">
              <ElOption
                v-for="task in tasks"
                :key="task.id"
                :label="
                  task.name + ' · ' + task.date + (task.report_type ? ' · ' + task.report_type : '')
                "
                :value="task.id"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="报告类型">
            <ElSelect
              v-model="form.type"
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入报告类型"
            >
              <ElOption v-for="item in REPORT_TYPES" :key="item" :label="item" :value="item" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="检查日期">
            <ElDatePicker v-model="form.exam_date" value-format="YYYY-MM-DD" />
          </ElFormItem>
        </div>
        <div class="upload-card">
          <ElFormItem label="上传报告图片 / PDF">
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,application/pdf"
              multiple
              :disabled="saving"
              @change="upload"
            />
          </ElFormItem>
          <p>已上传 {{ uploads.length }} 份，最多支持 10 份文件</p>
          <ElFormItem label="补充说明">
            <ElInput v-model="note" type="textarea" :rows="3" />
          </ElFormItem>
        </div>
      </ElForm>
      <template #footer>
        <ElButton :disabled="saving" @click="createVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="saveCreate">提交资料</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import ResearchExport from '@/components/business/research-export/index.vue'
  import ResearchScopeFilter from '@/components/business/research-scope-filter/index.vue'

  import { computed, onMounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { REPORT_TYPES } from '@/config/report-types'
  import request from '@/utils/http'
  import { fetchPatientList, type PatientRecord } from '@/api/patient'

  interface Report {
    id?: number
    user_id?: number
    task_id?: number
    patient_name?: string
    patient_code?: string
    type: string
    exam_date: string
    status: string
    task?: {
      id: number
      name: string
      date: string
      due_date: string
      status: string
    } | null
    ocr_result?: { summary: { field_count: number } } | null
  }

  const props = withDefaults(defineProps<{ embedded?: boolean; userId?: number }>(), {
      embedded: false,
      userId: 0
    }),
    blank = (): Report => ({ type: '', exam_date: '', status: '' }),
    route = useRoute(),
    router = useRouter(),
    embedded = computed(() => props.embedded),
    effectiveUserId = computed(() => props.userId || Number(route.query.user_id) || 0),
    form = ref(blank()),
    rows = ref<Report[]>([]),
    patients = ref<PatientRecord[]>([]),
    tasks = ref<
      {
        id: number
        name: string
        type: string
        report_type?: string
        date: string
        status: string
      }[]
    >([]),
    keyword = ref(''),
    status = ref(''),
    projectId = ref<number | undefined>(Number(route.query.project_id) || undefined),
    groupId = ref<number | undefined>(Number(route.query.group_id) || undefined),
    dateRange = ref<string[]>([]),
    current = ref(1),
    total = ref(0),
    loading = ref(false),
    saving = ref(false),
    createVisible = ref(false),
    uploads = ref<string[]>([]),
    note = ref('')

  function statusTagType(value: string) {
    if (value === '已核对') return 'success'
    if (value === '需补充') return 'danger'
    return 'warning'
  }
  async function load() {
    loading.value = true
    try {
      const page = await request.get<{ list: Report[]; total: number }>({
        url: '/app/core/report/index',
        params: {
          keyword: keyword.value,
          status: status.value || route.query.status,
          user_id: effectiveUserId.value || undefined,
          project_id: projectId.value,
          group_id: groupId.value,
          start_date: dateRange.value[0],
          end_date: dateRange.value[1],
          current: current.value,
          size: 10
        }
      })
      rows.value = page.list
      total.value = page.total
    } finally {
      loading.value = false
    }
  }
  function search() {
    current.value = 1
    void load()
  }
  function open(id?: number) {
    if (id) void router.push({ name: 'ReportDetail', params: { id } })
  }
  async function create() {
    form.value = blank()
    form.value.user_id = effectiveUserId.value || undefined
    uploads.value = []
    note.value = ''
    tasks.value = []
    const all: PatientRecord[] = []
    let pageNumber = 1
    while (true) {
      const page = await fetchPatientList({ current: pageNumber++, size: 100 })
      all.push(...page.list)
      if (all.length >= page.total) break
    }
    patients.value = all
    if (form.value.user_id) await patientChanged()
    createVisible.value = true
  }
  async function patientChanged() {
    form.value.task_id = undefined
    const all: typeof tasks.value = []
    let pageNumber = 1
    while (true) {
      const page = await request.get<{ list: typeof tasks.value; total: number }>({
        url: '/app/core/followup/index',
        params: { user_id: form.value.user_id, current: pageNumber++, size: 100 }
      })
      all.push(...page.list)
      if (all.length >= page.total) break
    }
    tasks.value = all.filter(
      (task) => task.type === '检查' && !['已完成', '已取消'].includes(task.status)
    )
  }
  function taskChanged(taskId?: number) {
    const task = tasks.value.find((item) => item.id === taskId)
    if (task?.report_type) form.value.type = task.report_type
  }
  async function upload(event: Event) {
    saving.value = true
    try {
      for (const file of Array.from((event.target as HTMLInputElement).files || [])) {
        const data = new FormData()
        data.append('file', file)
        const result = await request.post<{ url: string }>({
          url: '/app/core/file/upload-file',
          params: data
        })
        uploads.value.push(result.url)
      }
    } finally {
      ;(event.target as HTMLInputElement).value = ''
      saving.value = false
    }
  }
  async function saveCreate() {
    saving.value = true
    try {
      const report = await request.post<Report>({
        url: '/app/core/report/create',
        params: { ...form.value, files: uploads.value, note: note.value },
        showSuccessMessage: true
      })
      createVisible.value = false
      await load()
      open(report.id)
    } finally {
      saving.value = false
    }
  }
  function closeCreate(done: () => void) {
    if (!saving.value) done()
  }
  watch(
    () => [route.fullPath, effectiveUserId.value],
    () => {
      current.value = 1
      status.value = ''
      void load()
    }
  )
  onMounted(load)
</script>

<style scoped>
  .page {
    padding: 20px;
  }
  .page.embedded {
    padding: 0;
  }
  .page-header {
    display: flex;
    gap: 20px;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .page-header h2,
  .page-header p {
    margin: 0;
  }
  .page-header h2 {
    color: var(--art-text-gray-900);
    font-size: 22px;
  }
  .page-header p {
    margin-top: 6px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
  .header-actions {
    display: flex;
    flex: none;
    gap: 12px;
  }
  .filter-panel {
    display: grid;
    gap: 18px;
    margin-bottom: 20px;
    padding: 18px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
    background: var(--el-fill-color-extra-light);
  }
  .filter-panel--embedded {
    display: flex;
    justify-content: flex-end;
    padding: 12px;
  }
  .filter-block {
    display: grid;
    gap: 10px;
  }
  .filter-label,
  .filter-field > span {
    color: var(--el-text-color-regular);
    font-size: 13px;
    font-weight: 600;
  }
  .filter-block--scope :deep(.research-scope-filter) {
    display: grid;
    grid-template-columns: minmax(170px, 1fr) minmax(170px, 1fr) minmax(280px, 1.35fr);
    gap: 12px;
  }
  .filter-block--scope :deep(.research-scope-filter .el-select),
  .filter-block--scope :deep(.research-scope-filter .el-date-editor) {
    width: 100%;
  }
  .filter-block--query {
    grid-template-columns: minmax(260px, 1fr) minmax(170px, 220px) auto;
    align-items: end;
  }
  .filter-panel--embedded .filter-block--query {
    grid-template-columns: 180px auto;
  }
  .filter-field {
    display: grid;
    gap: 8px;
  }
  .filter-field :deep(.el-input),
  .filter-field :deep(.el-select),
  .create-grid :deep(.el-select),
  .create-grid :deep(.el-date-editor) {
    width: 100%;
  }
  .search-button {
    min-width: 88px;
  }
  .muted-text {
    color: var(--el-text-color-secondary);
  }
  .patient-code {
    display: block;
    margin-top: 3px;
    color: var(--el-text-color-secondary);
    font-weight: 400;
  }
  .related-task {
    display: grid;
    gap: 2px;
    line-height: 1.4;
  }
  .related-task small {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
  .el-pagination {
    margin-top: 20px;
  }
  .create-form {
    display: grid;
    gap: 20px;
  }
  .create-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 20px;
  }
  .upload-card {
    padding: 18px;
    border: 1px dashed var(--el-border-color);
    border-radius: 10px;
    background: var(--el-fill-color-extra-light);
  }
  .upload-card > p {
    margin: -6px 0 16px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
  @media (max-width: 760px) {
    .page {
      padding: 12px;
    }
    .page-header {
      align-items: stretch;
      flex-direction: column;
    }
    .header-actions > * {
      flex: 1;
    }
    .filter-block--scope :deep(.research-scope-filter),
    .filter-block--query,
    .filter-panel--embedded .filter-block--query,
    .create-grid {
      grid-template-columns: 1fr;
    }
    .filter-panel--embedded {
      display: grid;
      justify-content: stretch;
    }
  }
</style>
