<template>
  <div class="admin-patient-page">
    <div class="toolbar">
      <div>
        <h2>患者管理</h2>
      </div>
      <div class="actions"
        ><ElInput
          v-model="keyword"
          placeholder="姓名、手机号、患者编号"
          clearable
          @keyup.enter="search"
        /><ElButton @click="search">查询</ElButton
        ><ElButton type="primary" @click="management?.open()">新增患者</ElButton>
        <ElButton @click="loadList" :loading="loading">刷新</ElButton>
      </div>
    </div>

    <Management ref="management" @saved="loadList" /><ElCard shadow="never">
      <ElTable :data="list" v-loading="loading" border>
        <ElTableColumn prop="id" label="ID" width="80" /><ElTableColumn
          prop="patient_code"
          label="患者编号"
          width="120"
        /><ElTableColumn prop="group_name" label="研究分组" width="120" /><ElTableColumn
          prop="study_state"
          label="研究状态"
          width="100"
        />
        <ElTableColumn prop="name" label="患者姓名" min-width="140" />
        <ElTableColumn prop="mobile" label="手机号" min-width="150" />
        <ElTableColumn prop="gender_text" label="性别" width="90" />
        <ElTableColumn prop="age" label="年龄" width="90" />
        <ElTableColumn prop="hospital_name" label="就诊医院" min-width="180" />
        <ElTableColumn prop="department_name" label="就诊科室" min-width="150" />
        <ElTableColumn prop="visit_type_text" label="就诊类型" width="100" />
        <ElTableColumn label="建档状态" width="110">
          <template #default="{ row }">
            <ElTag :type="row.is_archived === 1 ? 'success' : 'info'">
              {{ row.is_archived === 1 ? '已建档' : '未建档' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="enroll_date" label="建档日期" min-width="120" />
        <ElTableColumn prop="created_at" label="创建时间" min-width="180" />
        <ElTableColumn label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="goPatientDetail(row)">详情</ElButton
            ><ElButton link type="primary" @click="management?.open(row.id)">研究管理</ElButton>
          </template>
        </ElTableColumn>
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

  import Management from './modules/management.vue'
  const management = ref<InstanceType<typeof Management>>()
  const keyword = ref('')
  function search() {
    pagination.current = 1
    void loadList()
  }

  import { fetchPatientList, type PatientRecord } from '@/api/patient'
  import { useRoute, useRouter } from 'vue-router'

  defineOptions({ name: 'AdminPatient' })

  const router = useRouter()
  const route = useRoute()
  watch(
    () => route.query.study_state,
    () => {
      pagination.current = 1
      void loadList()
    }
  )
  const loading = ref(false)
  const list = ref<PatientRecord[]>([])
  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  })

  const loadList = async () => {
    loading.value = true
    try {
      const res = await fetchPatientList({
        keyword: keyword.value,
        study_state:
          typeof route.query.study_state === 'string' ? route.query.study_state : undefined,
        current: pagination.current,
        size: pagination.size
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

  const goPatientDetail = (row: any) => {
    const record = row as PatientRecord
    router.push({
      path: '/patient/detail',
      query: {
        user_id: String(record.id)
      }
    })
  }

  onMounted(() => {
    loadList()
  })
</script>

<style scoped lang="scss">
  .admin-patient-page {
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
