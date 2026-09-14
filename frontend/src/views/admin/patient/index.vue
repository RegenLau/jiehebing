<template>
  <div class="admin-patient-page">
    <div class="toolbar">
      <div>
        <h2>患者管理</h2>
        <p>由后台统一维护患者档案、研究分组、用药安排和随访记录。</p>
      </div>
      <div class="actions"
        ><ElInput
          v-model="keyword"
          placeholder="姓名、手机号、患者编号"
          clearable
          @keyup.enter="search"
        /><ElSelect v-model="studyState" placeholder="全部研究状态" clearable @change="search">
          <ElOption v-for="state in studyStates" :key="state" :label="state" :value="state" />
        </ElSelect>
        <ElButton @click="search">查询</ElButton
        ><ElButton type="primary" @click="goPatientManagement()">新增患者</ElButton>
      </div>
    </div>

    <div class="scope-toolbar">
      <ResearchScopeFilter
        date-label="入组日期"
        v-model:project-id="projectId"
        v-model:group-id="groupId"
        v-model:date-range="dateRange"
        @change="search"
      />
      <ResearchExport
        kind="patients"
        :params="{
          keyword,
          study_state: studyState,
          project_id: projectId,
          group_id: groupId,
          start_date: dateRange[0],
          end_date: dateRange[1]
        }"
      />
    </div>

    <ElCard shadow="never">
      <ElTable :data="list" v-loading="loading" border>
        <ElTableColumn label="患者" min-width="210" fixed="left">
          <template #default="{ row }">
            <strong>{{ row.name }}</strong>
            <p class="cell-note">{{ row.patient_code }} · {{ row.mobile }}</p>
          </template>
        </ElTableColumn>
        <ElTableColumn label="研究 / 分组" min-width="220">
          <template #default="{ row }">
            <span>{{ row.project_name || '-' }}</span>
            <p class="cell-note">{{ row.group_name || '未分组' }}</p>
          </template>
        </ElTableColumn>
        <ElTableColumn label="用药方案" min-width="190">
          <template #default="{ row }">
            <span>{{ row.medication_scheme_name || '尚未关联用药方案' }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="研究状态" width="110">
          <template #default="{ row }"
            ><ElTag :type="stateTag(row.study_state)">{{
              row.study_state || '待启用'
            }}</ElTag></template
          >
        </ElTableColumn>
        <ElTableColumn label="方案确认" width="130">
          <template #default="{ row }">
            <ElTag
              :type="
                row.arrangement_type === '个体调整'
                  ? 'warning'
                  : row.arrangement_ready
                    ? 'success'
                    : 'info'
              "
            >
              {{ row.arrangement_type || '待确认方案' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="enroll_date" label="入组日期" width="120" />
        <ElTableColumn label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="goPatientManagement(row)">管理安排</ElButton>
            <ElButton link @click="goPatientDetail(row)">查看记录</ElButton>
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
  import ResearchScopeFilter from '@/components/business/research-scope-filter/index.vue'

  const keyword = ref('')
  const route = useRoute()
  const projectId = ref<number | undefined>(Number(route.query.project_id) || undefined)
  const groupId = ref<number | undefined>(Number(route.query.group_id) || undefined)
  const dateRange = ref<string[]>([])
  const studyStates = ['待启用', '治疗中', '暂停用药', '已完成', '提前退出', '失访']
  function search() {
    pagination.current = 1
    void loadList()
  }

  import { fetchPatientList, type PatientRecord } from '@/api/patient'
  import { useRoute, useRouter } from 'vue-router'

  defineOptions({ name: 'AdminPatient' })

  const router = useRouter()
  const studyState = ref(typeof route.query.study_state === 'string' ? route.query.study_state : '')
  watch(
    () => route.query.study_state,
    () => {
      studyState.value = typeof route.query.study_state === 'string' ? route.query.study_state : ''
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
        study_state: studyState.value || undefined,
        project_id: projectId.value,
        group_id: groupId.value,
        start_date: dateRange.value[0],
        end_date: dateRange.value[1],
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

  const goPatientManagement = (row?: any) => {
    const record = row as PatientRecord | undefined
    router.push({
      path: '/patient/management',
      query: record ? { user_id: String(record.id) } : undefined
    })
  }

  const stateTag = (state?: string): 'success' | 'warning' | 'danger' | 'info' => {
    if (state === '待启用' || state === '暂停用药') return 'warning'
    if (state === '治疗中') return 'success'
    if (state === '失访') return 'danger'
    return 'info'
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

    p {
      margin: 0;
      color: var(--el-text-color-secondary);
    }
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;

    .el-input {
      width: 240px;
    }

    .el-select {
      width: 150px;
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

  .cell-note {
    margin: 4px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  @media (max-width: 900px) {
    .toolbar {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
