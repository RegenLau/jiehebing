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
          label="状态"
          width="150"
          ><template #default="{ row }"
            >{{ row.status }} <ElTag v-if="row.overdue" type="danger">逾期</ElTag></template
          ></ElTableColumn
        ><ElTableColumn label="操作" width="90"
          ><template #default="{ row }"
            ><ElButton link type="primary" @click="open(row.id)">处理</ElButton></template
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
      :title="form.id ? '任务详情与处理' : '新增临时任务'"
      width="760px"
      :before-close="close"
      :close-on-click-modal="false"
      ><ElForm :disabled="saving" label-position="top"
        ><template v-if="!form.id"
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
                v-for="t in types.filter((t) => t !== '问卷')"
                :key="t"
                :label="t"
                :value="t" /></ElSelect></ElFormItem
          ><ElFormItem label="说明与提交要求"
            ><ElInput v-model="form.description" type="textarea" /></ElFormItem></template
        ><template v-else
          ><p>{{ form.patient_name }} · {{ form.name }} · {{ form.status }}</p
          ><p>{{ form.description }}</p
          ><ElFormItem label="处理操作"
            ><ElSelect v-model="action"
              ><ElOption label="记录联系" value="contact" /><ElOption
                label="调整日期"
                value="reschedule" /><ElOption label="要求补充" value="supplement" /><ElOption
                label="人工确认完成"
                value="complete"
                :disabled="['检查', '补交检查资料'].includes(form.type)" /><ElOption
                label="取消任务"
                value="cancel" /></ElSelect></ElFormItem></template
        ><div v-if="!form.id || action === 'reschedule'" class="toolbar"
          ><ElFormItem label="开始日期"
            ><ElDatePicker v-model="form.date" value-format="YYYY-MM-DD" /></ElFormItem
          ><ElFormItem label="截止日期"
            ><ElDatePicker v-model="form.due_date" value-format="YYYY-MM-DD" /></ElFormItem></div
        ><ElFormItem v-if="form.id" label="原因、结果或后续安排"
          ><ElInput v-model="reason" type="textarea" /></ElFormItem></ElForm
      ><ElTable v-if="form.id" :data="form.history || []"
        ><ElTableColumn prop="time" label="时间" /><ElTableColumn
          prop="operator"
          label="操作人" /><ElTableColumn prop="action" label="操作" /><ElTableColumn
          prop="reason"
          label="说明" /></ElTable
      ><template #footer
        ><ElButton :disabled="saving" @click="visible = false">关闭</ElButton
        ><ElButton
          :disabled="['已完成', '已取消'].includes(form.status)"
          type="primary"
          :loading="saving"
          @click="save"
          >保存</ElButton
        ></template
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
    id?: number
    user_id?: number
    patient_name?: string
    name: string
    type: string
    status: string
    description: string
    date: string
    due_date: string
    overdue?: boolean
    history?: { time: string; operator: string; action: string; reason: string }[]
  }
  const route = useRoute(),
    types = ['检查', '复诊', '取药', '补交检查资料', '问卷', '其他'],
    states = ['待完成', '已提交', '需补充', '已完成', '已取消'],
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
    action = ref('contact'),
    reason = ref(''),
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
    let n = 1
    while (true) {
      const p = await fetchPatientList({ current: n++, size: 100 })
      all.push(...p.list)
      if (all.length >= p.total) break
    }
    patients.value = all
    visible.value = true
  }
  async function open(id: number) {
    form.value = await request.get({ url: '/app/core/followup/detail', params: { id } })
    action.value = 'contact'
    reason.value = ''
    visible.value = true
  }
  async function save() {
    saving.value = true
    try {
      await request.post({
        url: '/app/core/followup/' + (form.value.id ? 'update' : 'create'),
        params: form.value.id
          ? {
              id: form.value.id,
              action: action.value,
              reason: reason.value,
              date: form.value.date,
              due_date: form.value.due_date
            }
          : form.value,
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
