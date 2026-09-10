<template>
  <div class="reminder-page">
    <div class="page-heading">
      <div>
        <h2>提醒方案</h2>
        <p>集中维护提醒规则，小组选择方案后直接沿用，减少重复配置。</p>
      </div>
      <ElButton type="primary" @click="open()">新增方案</ElButton>
    </div>

    <ElCard shadow="never">
      <div class="filters">
        <ElInput
          v-model.trim="keyword"
          placeholder="搜索方案名称或说明"
          clearable
          @keyup.enter="search"
          @clear="search"
        />
        <ElSelect v-model="status" placeholder="全部状态" clearable @change="search">
          <ElOption label="启用" :value="1" />
          <ElOption label="停用" :value="0" />
        </ElSelect>
        <ElButton type="primary" @click="search">查询</ElButton>
        <ElButton @click="reset">重置</ElButton>
      </div>

      <ElTable v-loading="loading" :data="rows" border empty-text="暂无提醒方案">
        <ElTableColumn prop="name" label="方案名称" min-width="180" />
        <ElTableColumn label="覆盖场景" min-width="260">
          <template #default="{ row }">
            <div class="scene-tags">
              <ElTag v-for="item in coverage(row as ReminderScheme)" :key="item" effect="plain">
                {{ item }}
              </ElTag>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="description" label="说明" min-width="220" show-overflow-tooltip />
        <ElTableColumn prop="version" label="版本" width="90" />
        <ElTableColumn label="状态" width="90">
          <template #default="{ row }">
            <ElTag :type="row.status === 1 ? 'success' : 'info'" effect="light">
              {{ row.status === 1 ? '启用' : '停用' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="open(row.id)">编辑</ElButton>
            <ElButton link type="warning" @click="toggle(row as ReminderScheme)">
              {{ row.status === 1 ? '停用' : '启用' }}
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <ElPagination
        v-model:current-page="current"
        :page-size="10"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="load"
      />
    </ElCard>

    <ElDialog
      v-model="visible"
      :title="form.id ? '编辑提醒方案' : '新增提醒方案'"
      width="min(760px, 95vw)"
      top="5vh"
      class="reminder-dialog"
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :before-close="close"
    >
      <ElForm label-position="top" :disabled="saving">
        <div class="basic-fields">
          <ElFormItem label="方案名称（必填）">
            <ElInput v-model.trim="form.name" maxlength="100" placeholder="例如 标准研究提醒" />
          </ElFormItem>
          <ElFormItem label="方案说明">
            <ElInput
              v-model.trim="form.description"
              maxlength="1000"
              placeholder="说明适用的研究或小组"
            />
          </ElFormItem>
        </div>

        <section class="rule-card">
          <div class="rule-card__heading">
            <div>
              <strong>服药提醒</strong>
              <p>按照患者个人用药时点生成提醒。</p>
            </div>
            <ElSwitch v-model="form.medication_enabled" />
          </div>
          <ElFormItem v-if="form.medication_enabled" label="提前提醒（分钟）">
            <ElInputNumber
              v-model="form.medication_advance_minutes"
              :min="0"
              :max="180"
              :precision="0"
            />
            <span class="field-help">0 表示到服药时点提醒</span>
          </ElFormItem>
        </section>

        <section class="rule-card">
          <div class="rule-card__heading">
            <div>
              <strong>随访任务提醒</strong>
              <p>适用于问卷、复查、复诊、报告和其他任务。</p>
            </div>
          </div>
          <ElCheckbox v-model="form.task_start_enabled">任务开始时</ElCheckbox>
          <ElCheckbox v-model="form.task_due_enabled">到期当天</ElCheckbox>
          <ElCheckbox v-model="form.task_overdue_enabled">逾期后</ElCheckbox>
          <ElFormItem label="提醒时间">
            <ElTimePicker
              v-model="form.task_remind_time"
              :disabled="
                !form.task_start_enabled && !form.task_due_enabled && !form.task_overdue_enabled
              "
              format="HH:mm"
              value-format="HH:mm"
              placeholder="选择时间"
            />
          </ElFormItem>
        </section>

        <section class="rule-card">
          <div class="rule-card__heading">
            <div>
              <strong>取药提醒</strong>
              <p>根据预计余药不足日期提前提醒患者联系医院。</p>
            </div>
            <ElSwitch v-model="form.pickup_enabled" />
          </div>
          <div v-if="form.pickup_enabled" class="pickup-fields">
            <ElFormItem label="提前提醒（天）">
              <ElInputNumber v-model="form.pickup_advance_days" :min="0" :max="60" :precision="0" />
            </ElFormItem>
            <ElFormItem label="提醒时间">
              <ElTimePicker
                v-model="form.pickup_remind_time"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="选择时间"
              />
            </ElFormItem>
          </div>
        </section>

        <ElAlert
          title="当前方案只定义提醒规则；具体患者、日期和任务由所属小组及个人安排决定。"
          type="info"
          :closable="false"
          show-icon
        />

        <ElFormItem v-if="form.id" label="修改原因（必填）" class="reason-field">
          <ElInput
            v-model.trim="form.reason"
            type="textarea"
            :rows="2"
            maxlength="300"
            show-word-limit
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton :disabled="saving" @click="visible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">保存方案</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import request from '@/utils/http'

  interface ReminderScheme {
    id?: number
    name: string
    description: string
    status: number
    revision?: number
    version?: string
    medication_enabled: boolean
    medication_advance_minutes: number
    task_start_enabled: boolean
    task_due_enabled: boolean
    task_overdue_enabled: boolean
    task_remind_time: string
    pickup_enabled: boolean
    pickup_advance_days: number
    pickup_remind_time: string
    reason: string
  }

  defineOptions({ name: 'ReminderSchemes' })

  const blank = (): ReminderScheme => ({
    name: '',
    description: '',
    status: 1,
    medication_enabled: true,
    medication_advance_minutes: 0,
    task_start_enabled: true,
    task_due_enabled: true,
    task_overdue_enabled: true,
    task_remind_time: '09:00',
    pickup_enabled: true,
    pickup_advance_days: 5,
    pickup_remind_time: '09:00',
    reason: ''
  })

  const rows = ref<ReminderScheme[]>([])
  const form = ref(blank())
  const keyword = ref('')
  const status = ref<number>()
  const current = ref(1)
  const total = ref(0)
  const loading = ref(false)
  const visible = ref(false)
  const saving = ref(false)

  function coverage(row: ReminderScheme) {
    const result: string[] = []
    if (row.medication_enabled) result.push('服药')
    if (row.task_start_enabled || row.task_due_enabled || row.task_overdue_enabled)
      result.push('随访任务')
    if (row.pickup_enabled) result.push('取药')
    return result
  }

  async function load() {
    loading.value = true
    try {
      const data = await request.get<{ list: ReminderScheme[]; total: number }>({
        url: '/app/core/reminder-scheme/index',
        params: { keyword: keyword.value, status: status.value, current: current.value, size: 10 }
      })
      rows.value = data.list
      total.value = data.total
    } finally {
      loading.value = false
    }
  }

  function search() {
    current.value = 1
    void load()
  }

  function reset() {
    keyword.value = ''
    status.value = undefined
    search()
  }

  async function open(id?: number) {
    form.value = id
      ? {
          ...blank(),
          ...(await request.get<ReminderScheme>({
            url: '/app/core/reminder-scheme/detail',
            params: { id }
          })),
          reason: ''
        }
      : blank()
    visible.value = true
  }

  async function save() {
    const hasTaskReminder =
      form.value.task_start_enabled ||
      form.value.task_due_enabled ||
      form.value.task_overdue_enabled
    if (!form.value.name.trim()) {
      ElMessage.warning('请填写方案名称')
      return
    }
    if (!form.value.medication_enabled && !hasTaskReminder && !form.value.pickup_enabled) {
      ElMessage.warning('请至少启用一个提醒场景')
      return
    }
    if (form.value.id && !form.value.reason.trim()) {
      ElMessage.warning('请填写修改原因')
      return
    }
    saving.value = true
    try {
      await request.post({
        url: '/app/core/reminder-scheme/save',
        params: form.value,
        showSuccessMessage: true
      })
      visible.value = false
      await load()
    } finally {
      saving.value = false
    }
  }

  async function toggle(row: ReminderScheme) {
    try {
      const { value } = await ElMessageBox.prompt(
        '请填写变更原因。已关联小组继续使用保存时的方案内容。',
        row.status === 1 ? '停用提醒方案' : '启用提醒方案',
        { inputValidator: (input) => Boolean(input?.trim()) || '请填写原因' }
      )
      await request.post({
        url: '/app/core/reminder-scheme/status',
        params: {
          id: row.id,
          version: row.version,
          status: row.status === 1 ? 0 : 1,
          reason: value
        },
        showSuccessMessage: true
      })
      await load()
    } catch {
      /* 用户取消或请求失败时保留当前列表 */
    }
  }

  function close(done: () => void) {
    if (!saving.value) done()
  }

  onMounted(load)
</script>

<style scoped>
  .reminder-page {
    padding: 20px;
  }

  .page-heading,
  .filters,
  .rule-card__heading,
  .scene-tags {
    display: flex;
    align-items: center;
  }

  .page-heading {
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 20px;
  }

  .page-heading h2 {
    margin: 0 0 6px;
    font-size: 22px;
  }

  .page-heading p,
  .rule-card p,
  .field-help {
    margin: 0;
    color: var(--el-text-color-secondary);
  }

  .filters {
    gap: 12px;
    margin-bottom: 16px;
  }

  .filters .el-input {
    width: 300px;
  }

  .filters .el-select {
    width: 140px;
  }

  .scene-tags {
    flex-wrap: wrap;
    gap: 6px;
  }

  .el-pagination {
    justify-content: flex-end;
    margin-top: 20px;
  }

  .basic-fields,
  .pickup-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 20px;
  }

  .rule-card {
    padding: 16px;
    margin-bottom: 14px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-fill-color-lighter);
  }

  .rule-card__heading {
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 14px;
  }

  .rule-card__heading strong {
    display: block;
    margin-bottom: 4px;
    font-size: 15px;
  }

  .rule-card .el-checkbox {
    margin-bottom: 14px;
  }

  .field-help {
    margin-left: 10px;
    font-size: 12px;
  }

  .reason-field {
    margin-top: 18px;
  }

  :deep(.reminder-dialog .el-dialog__body) {
    max-height: calc(90vh - 136px);
    overflow-y: auto;
  }

  @media (max-width: 720px) {
    .page-heading,
    .filters {
      align-items: stretch;
      flex-direction: column;
    }

    .filters .el-input,
    .filters .el-select,
    .basic-fields,
    .pickup-fields {
      width: 100%;
    }

    .basic-fields,
    .pickup-fields {
      grid-template-columns: 1fr;
    }
  }
</style>
