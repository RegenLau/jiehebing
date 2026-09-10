<template>
  <div class="medication-plan-page">
    <div class="toolbar">
      <div>
        <h2>用药计划</h2>
      </div>
      <div class="actions">
        <ElRadioGroup v-model="searchForm.scope" @change="handleScopeChange">
          <ElRadioButton label="today">今日用药计划</ElRadioButton>
          <ElRadioButton label="all">全部用药计划</ElRadioButton>
        </ElRadioGroup>
        <ElInput
          v-model.trim="searchForm.patient_name"
          placeholder="请输入患者姓名"
          clearable
          style="width: 220px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <ElDatePicker
          v-model="searchForm.plan_date"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="请选择计划日期"
          clearable
          style="width: 180px"
          :disabled="searchForm.scope === 'today'"
          @change="handleDateChange"
        />
        <ElSelect
          v-model="searchForm.status"
          placeholder="打卡状态"
          clearable
          style="width: 130px"
          @change="handleSearch"
        >
          <ElOption label="已打卡" :value="1" />
          <ElOption label="未打卡" :value="0" /><ElOption label="明确未服" :value="2" /><ElOption
            label="已取消/暂停"
            :value="3"
          />
        </ElSelect>
        <ElButton type="primary" @click="handleSearch">查询</ElButton>
        <ElButton @click="loadList" :loading="loading">刷新</ElButton>
      </div>
    </div>

    <div class="scope-toolbar">
      <ResearchScopeFilter
        v-model:project-id="searchForm.project_id"
        v-model:group-id="searchForm.group_id"
        v-model:date-range="searchForm.date_range"
        @change="handleScopeFilter"
      />
      <ResearchExport
        kind="medications"
        :params="{
          keyword: searchForm.patient_name,
          status: searchForm.status,
          user_id: searchForm.user_id,
          project_id: searchForm.project_id,
          group_id: searchForm.group_id,
          start_date: searchForm.date_range[0],
          end_date: searchForm.date_range[1]
        }"
      />
    </div>

    <ElCard shadow="never">
      <ElTable :data="list" v-loading="loading" border>
        <ElTableColumn prop="id" label="ID" width="80" />
        <ElTableColumn prop="patient_name" label="患者姓名" min-width="120" />
        <ElTableColumn prop="patient_mobile" label="手机号" min-width="140" />
        <ElTableColumn prop="name" label="药品名称" min-width="180" />
        <ElTableColumn prop="specification" label="规格" min-width="140" />
        <ElTableColumn prop="usage" label="服用方式" min-width="120" />
        <ElTableColumn prop="dosage" label="剂量" min-width="120" />
        <ElTableColumn prop="plan_date" label="计划日期" min-width="120" />
        <ElTableColumn prop="day_number" label="第几天" width="90" />
        <ElTableColumn prop="plan_time" label="提醒时间" width="100" />
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }">
            <ElTag :type="row.status === 1 ? 'success' : 'warning'">
              {{ row.status_text }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="跟进" width="190"
          ><template #default="{ row }"
            ><ElButton link type="primary" @click="recordResult(row.id, 1)">已服</ElButton
            ><ElButton link type="warning" @click="recordResult(row.id, 2)">未服</ElButton
            ><ElButton link @click="recordResult(row.id, 0)">联系</ElButton></template
          ></ElTableColumn
        ><ElTableColumn prop="record_reason" label="患者反馈说明" /><ElTableColumn
          prop="checked_at"
          label="打卡时间"
          min-width="180"
        />
      </ElTable>

      <div class="pagination">
        <ElPagination
          v-model:current-page="pagination.current"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, prev, pager, next, sizes, jumper"
          background
          @current-change="loadList"
          @size-change="handleSizeChange"
        />
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import ResearchExport from '@/components/business/research-export/index.vue'
  import ResearchScopeFilter from '@/components/business/research-scope-filter/index.vue'
  import request from '@/utils/http'
  import { ElMessageBox } from 'element-plus'
  async function recordResult(id: number, status: number) {
    try {
      const { value } = await ElMessageBox.prompt(
        '请填写患者反馈来源、未服原因或联系结果。',
        '登记服药跟进',
        { inputValidator: (v) => Boolean(v?.trim()) || '请填写说明' }
      )
      await request.post({
        url: '/app/core/medication-plan/' + (status ? 'record' : 'contact'),
        params: { id, status, reason: value },
        showSuccessMessage: true
      })
      await loadList()
    } catch {
      /* 取消或错误 */
    }
  }

  import { fetchMedicationPlanList, type MedicationPlanRecord } from '@/api/medication-plan'
  import { useRoute } from 'vue-router'

  defineOptions({ name: 'MedicationPlanIndex' })

  const route = useRoute()
  const loading = ref(false)
  const list = ref<MedicationPlanRecord[]>([])
  const searchForm = reactive({
    patient_name: '',
    plan_date: '',
    user_id: undefined as number | undefined,
    scope: 'today' as 'today' | 'all',
    status: undefined as 0 | 1 | 2 | 3 | undefined,
    overdue: false,
    as_of: undefined as string | undefined,
    overdue_range: undefined as '7d' | '30d' | undefined,
    project_id: undefined as number | undefined,
    group_id: undefined as number | undefined,
    date_range: [] as string[]
  })
  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  })

  const loadList = async () => {
    loading.value = true
    try {
      const res = await fetchMedicationPlanList({
        current: pagination.current,
        size: pagination.size,
        patient_name: searchForm.patient_name || undefined,
        plan_date: searchForm.scope === 'all' ? searchForm.plan_date || undefined : undefined,
        user_id: searchForm.user_id,
        scope: searchForm.scope,
        status: searchForm.status,
        overdue: searchForm.overdue || undefined,
        overdue_range: searchForm.overdue_range,
        as_of: searchForm.as_of,
        project_id: searchForm.project_id,
        group_id: searchForm.group_id,
        start_date: searchForm.date_range[0],
        end_date: searchForm.date_range[1]
      })
      list.value = res.list
      pagination.total = res.total
      pagination.current = res.current
      pagination.size = res.size
    } finally {
      loading.value = false
    }
  }

  const handleSizeChange = () => {
    pagination.current = 1
    loadList()
  }

  const handleSearch = () => {
    pagination.current = 1
    loadList()
  }

  const handleScopeChange = () => {
    searchForm.overdue = false
    searchForm.overdue_range = undefined
    searchForm.as_of = undefined
    if (searchForm.scope === 'today') {
      searchForm.plan_date = ''
    }
    handleSearch()
  }

  const handleDateChange = () => {
    searchForm.overdue = false
    searchForm.overdue_range = undefined
    searchForm.as_of = undefined
    handleSearch()
  }

  const handleScopeFilter = () => {
    if (searchForm.date_range.length) {
      searchForm.scope = 'all'
      searchForm.plan_date = ''
    }
    handleSearch()
  }

  const syncFromRoute = () => {
    searchForm.patient_name =
      typeof route.query.patient_name === 'string' ? route.query.patient_name : ''
    searchForm.user_id =
      typeof route.query.user_id === 'string' && route.query.user_id
        ? Number(route.query.user_id)
        : undefined
    searchForm.scope = route.query.scope === 'all' ? 'all' : 'today'
    searchForm.plan_date = typeof route.query.plan_date === 'string' ? route.query.plan_date : ''
    const routeStatus = Number(route.query.status)
    searchForm.status =
      routeStatus === 0 || routeStatus === 1 || routeStatus === 2 || routeStatus === 3
        ? routeStatus
        : undefined
    searchForm.overdue = route.query.overdue === '1'
    searchForm.as_of = typeof route.query.as_of === 'string' ? route.query.as_of : undefined
    searchForm.overdue_range =
      route.query.overdue_range === '7d' || route.query.overdue_range === '30d'
        ? route.query.overdue_range
        : undefined
    searchForm.project_id = route.query.project_id ? Number(route.query.project_id) : undefined
    searchForm.group_id = route.query.group_id ? Number(route.query.group_id) : undefined
    if (searchForm.overdue) {
      searchForm.scope = 'all'
      searchForm.plan_date = ''
    }
  }

  watch(
    () => route.fullPath,
    () => {
      if (route.path !== '/medication-plan/index') return
      syncFromRoute()
      pagination.current = 1
      loadList()
    },
    { immediate: true }
  )
</script>

<style scoped lang="scss">
  .medication-plan-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .toolbar {
    display: flex;
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;

    h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
    }
  }

  .scope-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    width: 100%;
  }

  .pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
</style>
