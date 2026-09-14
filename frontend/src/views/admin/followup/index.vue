<template>
  <div class="page"
    ><div class="toolbar"
      ><div class="title-copy"><h2>患者当前待办</h2><p>显示患者尚未完成的问卷、检查、提醒和每日反馈。</p></div
      ><ResearchExport
        kind="tasks"
        :params="{
          keyword,
          type,
          status,
          overdue: overdue || route.query.overdue === '1' ? '1' : '',
          user_id: route.query.user_id,
          project_id: projectId,
          group_id: groupId,
          start_date: dateRange[0],
          end_date: dateRange[1]
        }"
      /><ElButton type="primary" @click="openCreate">新增临时任务</ElButton></div
    ><ElCard shadow="never">
      <div class="filter-section">
        <ResearchScopeFilter
          date-label="任务日期"
          v-model:project-id="projectId"
          v-model:group-id="groupId"
          v-model:date-range="dateRange"
          @change="search"
        />
        <div class="filter-toolbar"
          ><ElInput
            v-model="keyword"
            placeholder="患者或任务名称"
            clearable
            @keyup.enter="search"
          /><ElSelect v-model="type" clearable placeholder="全部类型" @change="search"
            ><ElOption v-for="t in types" :key="t" :label="t" :value="t" /></ElSelect
          ><ElSelect v-model="status" clearable placeholder="全部状态" @change="search"
            ><ElOption v-for="s in states" :key="s" :label="s" :value="s" /></ElSelect
          ><div class="filter-actions"
            ><ElCheckbox v-model="overdue" @change="search">仅逾期</ElCheckbox
            ><ElButton @click="search">查询</ElButton></div
          ></div
        >
      </div>
      <ElTable v-loading="loading" :data="rows" border
        ><ElTableColumn prop="patient_name" label="患者" min-width="110" fixed="left" /><ElTableColumn
          prop="patient_code"
          label="患者编号"
          min-width="130"
          fixed="left"
        /><ElTableColumn
          prop="name"
          label="任务"
        /><ElTableColumn prop="type" label="类型" width="100" /><ElTableColumn
          prop="date"
          label="计划开放日期"
          width="120"
        /><ElTableColumn prop="due_date" label="截止日期" width="120" /><ElTableColumn
          label="提醒时间"
          width="100"
          ><template #default="{ row }">{{ row.remind_time || '-' }}</template></ElTableColumn
        ><ElTableColumn prop="display_source" label="来源" min-width="110" /><ElTableColumn
          prop="status"
          label="状态"
          width="100"
        /><ElTableColumn label="逾期状态" width="100"
          ><template #default="{ row }"
            ><ElTag v-if="row.overdue" type="danger">逾期</ElTag><span v-else>-</span></template
          ></ElTableColumn
        ><ElTableColumn label="操作" width="100" fixed="right"
          ><template #default="{ row }"
            ><ElButton link type="primary" @click="openDetail(row as Task)">查看详情</ElButton></template
          ></ElTableColumn
        ></ElTable
      ><ElPagination
        v-model:current-page="current"
        :page-size="10"
        :total="total"
        layout="total,prev,pager,next"
        @current-change="load"
    /></ElCard>
    <ElDialog
      v-model="visible"
      title="新增临时任务"
      width="760px"
      :before-close="close"
      :close-on-click-modal="false"
      ><ElForm :disabled="saving" label-position="top"
        ><ElFormItem label="患者"
          ><ElSelect v-model="form.user_id" filterable
            ><ElOption
              v-for="p in patients"
              :key="p.id"
              :label="p.name + ' · ' + p.mobile"
              :value="p.id" /></ElSelect></ElFormItem
        ><ElFormItem label="任务名称"><ElInput v-model="form.name" /></ElFormItem
        ><ElFormItem label="类型"
          ><ElSelect v-model="form.type"
            ><ElOption
              v-for="t in createTypes"
              :key="t"
              :label="t"
              :value="t" /></ElSelect></ElFormItem
        ><ElFormItem label="说明与提交要求"
          ><ElInput v-model="form.description" type="textarea" /></ElFormItem
        ><div class="toolbar"
          ><ElFormItem label="任务开放日期"
            ><ElDatePicker v-model="form.date" value-format="YYYY-MM-DD" /></ElFormItem
          ><ElFormItem label="最晚完成日期"
            ><ElDatePicker
              v-model="form.due_date"
              value-format="YYYY-MM-DD" /></ElFormItem></div></ElForm
      ><template #footer
        ><ElButton :disabled="saving" @click="visible = false">关闭</ElButton
        ><ElButton type="primary" :loading="saving" @click="save">保存</ElButton></template
      ></ElDialog
    ><ElDialog v-model="detailVisible" title="任务详情" width="720px"
      ><ElDescriptions v-if="currentTask" :column="2" border
        ><ElDescriptionsItem label="患者">{{ currentTask.patient_name }} · {{ currentTask.patient_code }}</ElDescriptionsItem
        ><ElDescriptionsItem label="任务状态">{{ currentTask.status }}</ElDescriptionsItem
        ><ElDescriptionsItem label="任务名称">{{ currentTask.name }}</ElDescriptionsItem
        ><ElDescriptionsItem label="任务类型">{{ currentTask.type }}</ElDescriptionsItem
        ><ElDescriptionsItem label="计划开放日期">{{ currentTask.date }}</ElDescriptionsItem
        ><ElDescriptionsItem label="最晚完成日期">{{ currentTask.due_date }}</ElDescriptionsItem
        ><ElDescriptionsItem label="任务来源">{{ currentTask.display_source }}</ElDescriptionsItem
        ><ElDescriptionsItem label="提醒时间">{{ currentTask.remind_time || '-' }}</ElDescriptionsItem
        ><ElDescriptionsItem label="任务说明" :span="2">{{ currentTask.description || '-' }}</ElDescriptionsItem
        ><ElDescriptionsItem label="提交要求" :span="2">{{ currentTask.requirements || '-' }}</ElDescriptionsItem
      ></ElDescriptions
      ><template #footer
        ><ElButton @click="goPatient">患者详情</ElButton
        ><ElButton v-if="currentTask?.report_id" type="primary" @click="goReport">关联报告</ElButton
        ><ElButton v-if="currentTask?.answer_id" type="primary" @click="goAnswer">该轮答卷</ElButton
        ><ElButton @click="detailVisible = false">关闭</ElButton></template
      ></ElDialog
    ></div
  >
</template>
<script setup lang="ts">
  import ResearchExport from '@/components/business/research-export/index.vue'
  import ResearchScopeFilter from '@/components/business/research-scope-filter/index.vue'

  import { ref, onMounted, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import request from '@/utils/http'
  import { fetchPatientList, type PatientRecord } from '@/api/patient'
  interface Task {
    id?: number | string
    user_id?: number
    patient_name?: string
    name: string
    type: string
    status: string
    description: string
    date: string
    due_date: string
    remind_time?: string
    source?: string
    overdue?: boolean
    patient_code?: string
    display_source?: string
    requirements?: string
    report_id?: number | null
    answer_id?: number | null
  }
  const route = useRoute(),
    router = useRouter(),
    types = ['提醒', '检查', '问卷', '健康反馈'],
    createTypes = ['提醒', '检查'],
    states = ['待完成', '需补充'],
    blank = (): Task => ({
      name: '',
      type: '检查',
      status: '待完成',
      description: '',
      date: '',
      due_date: ''
    })
  const rows = ref<Task[]>([]),
    form = ref(blank()),
    keyword = ref(''),
    projectId = ref<number | undefined>(Number(route.query.project_id) || undefined),
    groupId = ref<number | undefined>(Number(route.query.group_id) || undefined),
    dateRange = ref<string[]>([]),
    type = ref(''),
    status = ref(''),
    overdue = ref(false),
    current = ref(1),
    total = ref(0),
    loading = ref(false),
    saving = ref(false),
    visible = ref(false),
    detailVisible = ref(false),
    currentTask = ref<Task>(),
    patients = ref<PatientRecord[]>([])
  async function load() {
    loading.value = true
    try {
      const p = await request.get<{ list: Task[]; total: number }>({
        url: '/app/core/followup/index',
        params: {
          keyword: keyword.value,
          type: type.value,
          status: status.value,
          overdue: overdue.value || route.query.overdue === '1' ? '1' : '',
          user_id: route.query.user_id,
          project_id: projectId.value,
          group_id: groupId.value,
          start_date: dateRange.value[0],
          end_date: dateRange.value[1],
          current: current.value,
          size: 10
        }
      })
      rows.value = p.list
      total.value = p.total
    } finally {
      loading.value = false
    }
  }
  function search() {
    current.value = 1
    void load()
  }
  async function openCreate() {
    form.value = blank()
    const all: PatientRecord[] = []
    let fetched = 0
    let n = 1
    while (true) {
      const p = await fetchPatientList({ current: n++, size: 100 })
      fetched += p.list.length
      all.push(...p.list)
      if (fetched >= p.total || p.list.length === 0) break
    }
    patients.value = all
    visible.value = true
  }
  async function save() {
    saving.value = true
    try {
      await request.post({
        url: '/app/core/followup/create',
        params: form.value,
        showSuccessMessage: true
      })
      visible.value = false
      await load()
    } finally {
      saving.value = false
    }
  }
  function close(done: () => void) {
    if (!saving.value) done()
  }
  function openDetail(row: Task) {
    currentTask.value = row
    detailVisible.value = true
  }
  function goPatient() {
    if (!currentTask.value?.user_id) return
    void router.push({ path: '/patient/detail', query: { user_id: currentTask.value.user_id } })
  }
  function goReport() {
    if (!currentTask.value?.report_id) return
    void router.push(`/reports/detail/${currentTask.value.report_id}`)
  }
  function goAnswer() {
    if (!currentTask.value?.user_id) return
    void router.push({
      path: '/patient/detail',
      query: {
        user_id: currentTask.value.user_id,
        tab: 'survey',
        answer_id: currentTask.value.answer_id
      }
    })
  }
  watch(
    () => route.fullPath,
    () => {
      current.value = 1
      void load()
    }
  )
  onMounted(load)
</script>
<style scoped>
  .page {
    padding: 20px;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }
  .toolbar h2 {
    flex: 1;
  }
  .title-copy {
    flex: 1;
  }
  .title-copy h2,
  .title-copy p {
    margin: 0;
  }
  .title-copy p {
    margin-top: 5px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
  .toolbar .el-input {
    max-width: 240px;
  }
  .toolbar .el-select {
    width: 150px;
  }
  .filter-section {
    display: grid;
    gap: 16px;
    margin-bottom: 20px;
  }
  .filter-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 16px;
  }
  .filter-toolbar .el-input {
    width: 240px;
    min-width: 180px;
    max-width: 240px;
    flex: 1 1 180px;
  }
  .filter-toolbar .el-select {
    width: 150px;
  }
  .filter-actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .filter-actions .el-checkbox {
    margin-right: 0;
  }
  .el-pagination {
    margin-top: 20px;
  }
</style>
