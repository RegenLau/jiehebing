<template>
  <div class="page"
    ><div class="toolbar"
      ><h2>随访任务</h2
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
        ><ElTableColumn prop="patient_name" label="患者" /><ElTableColumn
          prop="name"
          label="任务"
        /><ElTableColumn prop="type" label="类型" width="100" /><ElTableColumn
          prop="date"
          label="开始日期"
          width="120"
        /><ElTableColumn prop="due_date" label="截止日期" width="120" /><ElTableColumn
          label="提醒时间"
          width="100"
          ><template #default="{ row }">{{ row.remind_time || '-' }}</template></ElTableColumn
        ><ElTableColumn prop="source" label="来源" min-width="120" /><ElTableColumn
          label="状态"
          width="150"
          ><template #default="{ row }"
            >{{ row.status }} <ElTag v-if="row.overdue" type="danger">逾期</ElTag></template
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
          ><ElFormItem label="开始日期"
            ><ElDatePicker v-model="form.date" value-format="YYYY-MM-DD" /></ElFormItem
          ><ElFormItem label="截止日期"
            ><ElDatePicker
              v-model="form.due_date"
              value-format="YYYY-MM-DD" /></ElFormItem></div></ElForm
      ><template #footer
        ><ElButton :disabled="saving" @click="visible = false">关闭</ElButton
        ><ElButton type="primary" :loading="saving" @click="save">保存</ElButton></template
      ></ElDialog
    ></div
  >
</template>
<script setup lang="ts">
  import ResearchExport from '@/components/business/research-export/index.vue'
  import ResearchScopeFilter from '@/components/business/research-scope-filter/index.vue'

  import { ref, onMounted, watch } from 'vue'
  import { useRoute } from 'vue-router'
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
  }
  const route = useRoute(),
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
      all.push(
        ...p.list.filter((patient) => patient.created_via === 'admin' && patient.login_enabled)
      )
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
