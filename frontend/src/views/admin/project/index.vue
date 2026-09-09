<template>
  <div class="project-page">
    <div class="heading"
      ><div><h2>研究项目管理</h2><p>建立研究项目，在研究分组中关联通用方案和随访内容。</p></div
      ><ElButton type="primary" @click="edit()">新增项目</ElButton></div
    >
    <ElCard shadow="never">
      <div class="filters"
        ><ElInput
          v-model.trim="search.keyword"
          placeholder="搜索项目编号或名称"
          clearable
          style="width: 320px"
          @keyup.enter="query"
          @clear="query"
        /><ElSelect
          v-model="search.status"
          placeholder="全部状态"
          clearable
          style="width: 150px"
          @change="query"
          ><ElOption
            v-for="s in statuses"
            :key="s.value"
            :label="s.label"
            :value="s.value" /></ElSelect
        ><ElButton type="primary" @click="query">查询</ElButton
        ><ElButton @click="reset">重置</ElButton
        ><ElButton :loading="loading" @click="load">刷新</ElButton></div
      >
      <ElTable v-loading="loading" :data="list" border empty-text="暂无符合条件的项目">
        <ElTableColumn prop="code" label="项目编号" min-width="140" /><ElTableColumn
          prop="name"
          label="项目名称"
          min-width="220"
          show-overflow-tooltip
        />
        <ElTableColumn label="研究类型" width="110"
          ><template #default="{ row }">{{ typeLabel(row.research_type) }}</template></ElTableColumn
        >
        <ElTableColumn label="研究周期" min-width="210"
          ><template #default="{ row }"
            >{{ row.start_date }} 至 {{ row.end_date }}</template
          ></ElTableColumn
        >
        <ElTableColumn prop="group_count" label="分组数" width="80" />
        <ElTableColumn label="状态" width="100"
          ><template #default="{ row }"
            ><ElTag :type="row.status === 1 ? 'success' : 'info'">{{
              statusLabel(row.status)
            }}</ElTag></template
          ></ElTableColumn
        >
        <ElTableColumn label="操作" width="230" fixed="right"
          ><template #default="{ row }"
            ><ElButton link type="primary" @click="showDetail(row.id)">详情</ElButton
            ><ElButton
              link
              type="primary"
              @click="router.push({ path: '/project/groups', query: { project_id: row.id } })"
              >分组</ElButton
            ><ElButton link type="primary" @click="edit(row.id)">编辑</ElButton
            ><ElButton link type="primary" @click="openStatus(row.id)">状态</ElButton></template
          ></ElTableColumn
        >
      </ElTable>
      <div class="pagination"
        ><ElPagination
          v-model:current-page="pager.current"
          v-model:page-size="pager.size"
          :total="pager.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="load"
          @size-change="query"
      /></div>
    </ElCard>
    <ElDialog
      v-model="formVisible"
      :title="form.id ? '编辑研究项目' : '新增研究项目'"
      width="min(720px,95vw)"
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :before-close="closeForm"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-position="top" :disabled="saving">
        <div class="fields"
          ><ElFormItem label="项目编号" prop="code"
            ><ElInput
              v-model.trim="form.code"
              maxlength="40"
              placeholder="例如 TB-2026-001" /></ElFormItem
          ><ElFormItem label="项目名称" prop="name"
            ><ElInput v-model.trim="form.name" maxlength="100"
          /></ElFormItem>
          <ElFormItem label="研究类型" prop="research_type"
            ><ElSelect v-model="form.research_type"
              ><ElOption
                v-for="s in types"
                :key="s.value"
                :label="s.label"
                :value="s.value" /></ElSelect
          ></ElFormItem>
          <ElFormItem label="开始日期" prop="start_date"
            ><ElDatePicker v-model="form.start_date" value-format="YYYY-MM-DD" /></ElFormItem
          ><ElFormItem label="结束日期" prop="end_date"
            ><ElDatePicker v-model="form.end_date" value-format="YYYY-MM-DD" /></ElFormItem
        ></div>
        <ElFormItem label="研究目的"
          ><ElInput
            v-model.trim="form.purpose"
            type="textarea"
            :rows="3"
            maxlength="1000"
            show-word-limit /></ElFormItem
        ><ElFormItem label="备注"
          ><ElInput v-model.trim="form.notes" type="textarea" maxlength="1000" show-word-limit
        /></ElFormItem> </ElForm
      ><template #footer
        ><ElButton :disabled="saving" @click="formVisible = false">取消</ElButton
        ><ElButton type="primary" :loading="saving" @click="submit">保存</ElButton></template
      >
    </ElDialog>
    <ElDialog
      v-model="detailVisible"
      title="研究项目详情"
      width="min(1140px,96vw)"
      :close-on-click-modal="false"
    >
      <div v-loading="detailLoading" style="min-height: 240px"
        ><template v-if="detail"
          ><h3>{{ detail.name }}</h3
          ><ElTabs v-model="tab">
            <ElTabPane label="基本信息" name="base"
              ><ElDescriptions :column="2" border
                ><ElDescriptionsItem v-for="(label, key) in labels" :key="key" :label="label">{{
                  key === 'research_type' ? typeLabel(detail.research_type) : detail[key] || '—'
                }}</ElDescriptionsItem
                ><ElDescriptionsItem label="状态">{{
                  statusLabel(detail.status)
                }}</ElDescriptionsItem></ElDescriptions
              ></ElTabPane
            >
            <ElTabPane label="变更记录" name="history"
              ><ElTable :data="detail.history" border
                ><ElTableColumn prop="time" label="时间" width="170" /><ElTableColumn
                  prop="operator"
                  label="操作人"
                  width="110"
                /><ElTableColumn prop="action" label="操作" width="100" /><ElTableColumn
                  prop="note"
                  label="说明"
                  min-width="160"
                /><ElTableColumn label="修改内容" min-width="250"
                  ><template #default="{ row }"
                    ><div v-for="(c, i) in row.changes" :key="i"
                      ><template v-if="c.field !== 'group'"
                        >{{ changeLabel(c.field) }}：{{ changeValue(c.field, c.before) }} →
                        {{ changeValue(c.field, c.after) }}</template
                      ><ElCollapse v-else
                        ><ElCollapseItem title="查看分组配置修改前后内容"
                          ><strong>修改前</strong><pre>{{ groupSummary(c.before) }}</pre
                          ><strong>修改后</strong><pre>{{ groupSummary(c.after) }}</pre>
                        </ElCollapseItem></ElCollapse
                      ></div
                    ></template
                  ></ElTableColumn
                ></ElTable
              ></ElTabPane
            >
          </ElTabs></template
        ></div
      >
    </ElDialog>
    <ElDialog
      v-model="statusVisible"
      title="变更项目状态"
      width="480px"
      :close-on-click-modal="false"
      :close-on-press-escape="!statusSaving"
      :before-close="closeStatus"
      ><p>项目：{{ statusProject?.name }}</p
      ><p class="muted">只更新项目记录，不自动改变患者治疗或任务。</p
      ><ElForm label-position="top" :disabled="statusSaving"
        ><ElFormItem label="目标状态"
          ><ElSelect v-model="targetStatus"
            ><ElOption
              v-for="s in statuses"
              :key="s.value"
              :label="s.label"
              :value="s.value"
              :disabled="s.value === statusProject?.status" /></ElSelect></ElFormItem
        ><ElFormItem label="变更原因"
          ><ElInput
            v-model.trim="reason"
            type="textarea"
            maxlength="300"
            show-word-limit /></ElFormItem></ElForm
      ><template #footer
        ><ElButton :disabled="statusSaving" @click="statusVisible = false">取消</ElButton
        ><ElButton type="primary" :loading="statusSaving" @click="submitStatus"
          >确认变更</ElButton
        ></template
      ></ElDialog
    >
  </div>
</template>
<script setup lang="ts">
  import { nextTick, onActivated, reactive, ref } from 'vue'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import {
    fetchProjectList,
    fetchProjectDetail,
    saveProject,
    changeProjectStatus,
    type GroupRecord,
    type ProjectPayload,
    type ProjectRecord,
    type ProjectStatus,
    type ResearchType
  } from '@/api/project'
  import { useRouter } from 'vue-router'
  const router = useRouter()
  defineOptions({ name: 'ProjectIndex' })
  const statuses = [
    { value: 0, label: '未开始' },
    { value: 1, label: '进行中' },
    { value: 2, label: '已结束' }
  ]
  const types = [
    { value: 'open', label: '开放研究' },
    { value: 'single_blind', label: '单盲研究' },
    { value: 'double_blind', label: '双盲研究' }
  ]
  const statusLabel = (v: number) => statuses.find((s) => s.value === v)?.label || '未知'
  const typeLabel = (v: string) => types.find((s) => s.value === v)?.label || '未填写'
  const labels = {
    code: '项目编号',
    name: '项目名称',
    research_type: '研究类型',
    start_date: '开始日期',
    end_date: '结束日期',
    purpose: '研究目的',
    notes: '备注'
  }
  const changeLabel = (key: string) =>
    key === 'status' ? '状态' : labels[key as keyof typeof labels] || key
  const changeValue = (key: string, value: unknown) =>
    key === 'status'
      ? statusLabel(Number(value))
      : key === 'research_type'
        ? typeLabel(String(value))
        : String(value || '（空）')
  function groupSummary(value: unknown) {
    const g = value as GroupRecord
    if (!g || !g.name) return '尚未创建'
    const m = g.medication
    const lines = [
      `分组：${g.name}`,
      `说明：${g.description || '无'}`,
      `用药方案：${m?.snapshot.name || '未关联'}`
    ]
    if (m) {
      lines.push(
        `治疗 ${m.treatment_days} 天；取药周期 ${m.pickup_days} 天；提前 ${m.advance_days} 天提醒`
      )
      for (const d of m.snapshot.drugs || [])
        lines.push(
          `${d.name}：${d.dose}${d.unit}/次，${d.frequency}，${d.times}；首次发药 ${m.quantities.find((q) => q.drug_id === d.drug_id)?.quantity || 0}${d.unit}`
        )
    }
    for (const [label, rows] of [
      ['问卷', g.surveys],
      ['任务', g.tasks]
    ] as const) {
      for (const r of rows || []) {
        const anchor =
          r.anchor === 'date'
            ? r.date
            : `${r.anchor === 'enrollment' ? '入组' : '开始用药'}后 ${r.offset_days} 天`
        lines.push(
          `${label}：${r.snapshot.name}；${anchor}；${r.interval_days ? `每 ${r.interval_days} 天` : '单次'}；期限 ${r.deadline_days} 天；提醒：${[r.reminders.start && '开始', r.reminders.due && '到期', r.reminders.overdue && '逾期'].filter(Boolean).join('、') || '无'}`
        )
      }
    }
    lines.push(
      `受试者：${g.participants?.map((p) => `${p.name}（${p.mobile}）`).join('、') || '未添加'}`
    )
    return lines.join('\n')
  }
  const blank = (): ProjectPayload => ({
    code: '',
    name: '',
    research_type: 'open',
    start_date: '',
    end_date: '',
    purpose: '',
    notes: ''
  })
  const list = ref<ProjectRecord[]>([]),
    loading = ref(false),
    detailLoading = ref(false)
  const pager = reactive({ current: 1, size: 10, total: 0 }),
    search = reactive({ keyword: '', status: undefined as ProjectStatus | undefined })
  const form = ref(blank()),
    formRef = ref<FormInstance>(),
    formVisible = ref(false),
    saving = ref(false)
  const detail = ref<ProjectRecord>(),
    detailVisible = ref(false),
    tab = ref('base')
  const statusVisible = ref(false),
    statusSaving = ref(false),
    statusProject = ref<ProjectRecord>(),
    targetStatus = ref<ProjectStatus>(),
    reason = ref('')
  let request = 0,
    detailRequest = 0,
    editRequest = 0
  const rules: FormRules = {
    code: [
      { required: true, message: '请填写项目编号' },
      { pattern: /^[A-Za-z0-9][A-Za-z0-9_-]*$/, message: '编号仅支持字母、数字、短横线和下划线' }
    ],
    name: [{ required: true, message: '请填写项目名称' }],
    research_type: [{ required: true, message: '请选择研究类型' }],
    start_date: [{ required: true, message: '请选择开始日期' }],
    end_date: [{ required: true, message: '请选择结束日期' }]
  }
  async function load() {
    const seq = ++request
    loading.value = true
    try {
      const r = await fetchProjectList({ ...search, current: pager.current, size: pager.size })
      if (seq !== request) return
      list.value = r.list
      pager.total = r.total
    } catch {
      if (seq === request) {
        list.value = []
        pager.total = 0
      }
    } finally {
      if (seq === request) loading.value = false
    }
  }
  function query() {
    pager.current = 1
    void load()
  }
  function reset() {
    search.keyword = ''
    search.status = undefined
    query()
  }
  function closeForm(done: () => void) {
    if (!saving.value) done()
  }
  function closeStatus(done: () => void) {
    if (!statusSaving.value) done()
  }
  async function edit(id?: number) {
    const seq = ++editRequest
    try {
      const r = id ? await fetchProjectDetail(id) : blank()
      if (seq !== editRequest) return
      form.value = {
        id: r.id,
        code: r.code,
        name: r.name,
        research_type: r.research_type as ResearchType,
        start_date: r.start_date,
        end_date: r.end_date,
        purpose: r.purpose,
        notes: r.notes
      }
      formVisible.value = true
      await nextTick()
      formRef.value?.clearValidate()
    } catch {
      /* 请求层提示 */
    }
  }
  async function submit() {
    if (saving.value || !(await formRef.value?.validate().catch(() => false))) return
    if (form.value.end_date < form.value.start_date) {
      ElMessage.warning('结束日期不能早于开始日期')
      return
    }
    saving.value = true
    try {
      await saveProject(form.value)
      formVisible.value = false
      query()
    } catch {
      /* 保留表单 */
    } finally {
      saving.value = false
    }
  }
  async function showDetail(id: number) {
    tab.value = 'base'
    detail.value = undefined
    detailVisible.value = true
    await getDetail(id)
  }
  async function getDetail(id: number) {
    const seq = ++detailRequest
    detailLoading.value = true
    try {
      const r = await fetchProjectDetail(id)
      if (seq === detailRequest) detail.value = r
    } catch {
      /* 请求层提示 */
    } finally {
      if (seq === detailRequest) detailLoading.value = false
    }
  }
  async function openStatus(id: number) {
    try {
      statusProject.value = await fetchProjectDetail(id)
      targetStatus.value = undefined
      reason.value = ''
      statusVisible.value = true
    } catch {
      /* 请求层提示 */
    }
  }
  async function submitStatus() {
    if (statusSaving.value) return
    if (targetStatus.value === undefined || !reason.value) {
      ElMessage.warning('请选择目标状态并填写原因')
      return
    }
    statusSaving.value = true
    try {
      await changeProjectStatus(
        statusProject.value!.id,
        targetStatus.value,
        reason.value,
        statusProject.value!.status
      )
      statusVisible.value = false
      await load()
    } catch {
      /* 请求层提示 */
    } finally {
      statusSaving.value = false
    }
  }
  onActivated(load)
</script>
<style scoped>
  .project-page {
    padding: 20px;
    min-width: 0;
  }
  .heading,
  .filters {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }
  .heading {
    justify-content: space-between;
  }
  .heading h2 {
    margin: 0;
    font-size: 22px;
  }
  .heading p,
  .muted {
    color: var(--el-text-color-secondary);
  }
  .filters {
    flex-wrap: wrap;
  }
  .pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 20px;
  }
  .fields :deep(.el-date-editor),
  .fields :deep(.el-select) {
    width: 100%;
  }
  pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 320px;
    overflow: auto;
  }
  .project-page :deep(.el-descriptions__content) {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
</style>
