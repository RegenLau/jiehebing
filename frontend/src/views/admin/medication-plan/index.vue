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
          <ElOption label="未打卡" :value="0" />
        </ElSelect>
        <ElButton type="primary" @click="handleSearch">查询</ElButton>
        <ElButton @click="loadList" :loading="loading">刷新</ElButton>
      </div>
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
        <ElTableColumn prop="checked_at" label="打卡时间" min-width="180" />
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
    status: undefined as 0 | 1 | undefined,
    overdue: false,
    as_of: undefined as string | undefined,
    overdue_range: undefined as '7d' | '30d' | undefined
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
        as_of: searchForm.as_of
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

  const syncFromRoute = () => {
    searchForm.patient_name =
      typeof route.query.patient_name === 'string' ? route.query.patient_name : ''
    searchForm.user_id =
      typeof route.query.user_id === 'string' && route.query.user_id
        ? Number(route.query.user_id)
        : undefined
    searchForm.scope = route.query.scope === 'all' ? 'all' : 'today'
    searchForm.plan_date = typeof route.query.plan_date === 'string' ? route.query.plan_date : ''
    searchForm.status = route.query.status === '0' ? 0 : route.query.status === '1' ? 1 : undefined
    searchForm.overdue = route.query.overdue === '1'
    searchForm.as_of = typeof route.query.as_of === 'string' ? route.query.as_of : undefined
    searchForm.overdue_range =
      route.query.overdue_range === '7d' || route.query.overdue_range === '30d'
        ? route.query.overdue_range
        : undefined
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
    align-items: center;
    justify-content: space-between;
    gap: 16px;

    h2 {
      margin: 0 0 6px;
      font-size: 22px;
      font-weight: 700;
    }
  }

  .actions {
    display: flex;
    gap: 12px;
  }

  .pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
</style>
