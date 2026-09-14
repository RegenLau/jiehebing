<template>
  <div class="adverse-reaction-page">
    <div class="toolbar">
      <div>
        <h2>不良反应上报</h2>
        <p>优先处理重度、待处理和未分配负责人事件。</p>
      </div>
      <div class="actions">
        <ElInput
          v-model.trim="searchForm.patient_name"
          placeholder="患者姓名或编号"
          clearable
          style="width: 200px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <ElSelect
          v-model="searchForm.severity"
          placeholder="请选择严重程度"
          clearable
          style="width: 145px"
          @change="handleSearch"
        >
          <ElOption label="轻度" :value="1" />
          <ElOption label="中度" :value="2" />
          <ElOption label="重度" :value="3" />
        </ElSelect>
        <ElSelect
          v-model="searchForm.processing_status"
          placeholder="处理状态"
          clearable
          style="width: 130px"
          @change="handleSearch"
        >
          <ElOption v-for="item in ['待处理', '处理中', '已处理']" :key="item" :label="item" :value="item" />
        </ElSelect>
        <ElSelect
          v-model="searchForm.owner_id"
          placeholder="负责人"
          clearable
          style="width: 140px"
          @change="handleSearch"
        >
          <ElOption
            v-for="owner in owners"
            :key="owner.id"
            :label="owner.realname || owner.username"
            :value="owner.id"
          />
        </ElSelect>
        <ElButton type="primary" @click="handleSearch">查询</ElButton>
        <ElButton @click="loadList" :loading="loading">刷新</ElButton>
        <ElButton type="primary" @click="handleExport" :loading="exportLoading"
          >导出 Excel</ElButton
        >
      </div>
    </div>

    <div class="scope-toolbar">
      <ResearchScopeFilter
        v-model:project-id="searchForm.project_id"
        v-model:group-id="searchForm.group_id"
        :show-date="false"
        @change="handleSearch"
      />
      <ElTag v-if="searchForm.as_of" type="info" effect="plain">
        统计截至 {{ searchForm.as_of }}
      </ElTag>
    </div>

    <Assessment ref="assessment" @saved="loadList" />
    <ElCard shadow="never">
      <ElTable :data="list" v-loading="loading" border>
        <ElTableColumn prop="patient_name" label="患者姓名" min-width="120" fixed="left" />
        <ElTableColumn prop="patient_code" label="患者编号" min-width="130" fixed="left" />
        <ElTableColumn label="严重程度" width="100">
          <template #default="{ row }">
            <ElTag :type="severityTagType(row.severity)">
              {{ row.severity_text }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="处理状态" width="100">
          <template #default="{ row }">
            <ElTag :type="row.processing_status === '已处理' ? 'success' : row.processing_status === '处理中' ? 'primary' : 'warning'">
              {{ row.processing_status || '待处理' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="负责人" min-width="120">
          <template #default="{ row }">{{ row.owner_name || row.assessment?.owner_name || '未分配' }}</template>
        </ElTableColumn>
        <ElTableColumn prop="occurred_at" label="发生时间" min-width="160" />
        <ElTableColumn
          prop="symptom_summary"
          label="主要症状"
          min-width="220"
          show-overflow-tooltip
        />
        <ElTableColumn prop="project_name" label="参与项目" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.project_name || '未参与项目' }}</template>
        </ElTableColumn>
        <ElTableColumn prop="group_name" label="入组名称" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.group_name || '未入组' }}</template>
        </ElTableColumn>
        <ElTableColumn prop="patient_mobile" label="手机号" min-width="140" />
        <ElTableColumn prop="created_at" label="上报时间" min-width="180" />
        <ElTableColumn label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="assessment?.open(row.id)">查看并处理</ElButton>
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
  import { useRoute } from 'vue-router'
  import ResearchScopeFilter from '@/components/business/research-scope-filter/index.vue'
  import request from '@/utils/http'
  const route = useRoute()
  watch(
    () => route.fullPath,
    () => {
      searchForm.project_id = route.query.project_id ? Number(route.query.project_id) : undefined
      searchForm.group_id = route.query.group_id ? Number(route.query.group_id) : undefined
      searchForm.processing_status =
        typeof route.query.processing_status === 'string' ? route.query.processing_status : ''
      searchForm.as_of = typeof route.query.as_of === 'string' ? route.query.as_of : ''
      pagination.current = 1
      void loadList()
    }
  )

  import Assessment from './modules/assessment.vue'
  const assessment = ref<InstanceType<typeof Assessment>>()

  import {
    exportAdverseReactionList,
    fetchAdverseReactionList,
    type AdverseReactionRecord
  } from '@/api/adverse-reaction'
  import { ElMessage } from 'element-plus'

  defineOptions({ name: 'AdverseReactionIndex' })

  const loading = ref(false)
  const exportLoading = ref(false)
  const list = ref<AdverseReactionRecord[]>([])
  const owners = ref<{ id: number; realname: string; username: string }[]>([])
  const searchForm = reactive({
    patient_name: '',
    severity: undefined as number | undefined,
    processing_status: typeof route.query.processing_status === 'string' ? route.query.processing_status : '',
    owner_id: undefined as number | undefined,
    project_id: route.query.project_id ? Number(route.query.project_id) : undefined,
    group_id: route.query.group_id ? Number(route.query.group_id) : undefined,
    as_of: typeof route.query.as_of === 'string' ? route.query.as_of : ''
  })
  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  })

  const severityTagType = (severity: number) => {
    if (severity === 3) return 'danger'
    if (severity === 2) return 'warning'
    return 'success'
  }

  const loadList = async () => {
    loading.value = true
    try {
      const res = await fetchAdverseReactionList({
        pending: route.query.pending === '1' ? '1' : undefined,
        current: pagination.current,
        size: pagination.size,
        patient_name: searchForm.patient_name || undefined,
        severity: searchForm.severity,
        processing_status: searchForm.processing_status || undefined,
        owner_id: searchForm.owner_id,
        project_id: searchForm.project_id,
        group_id: searchForm.group_id,
        as_of: searchForm.as_of || undefined
      })
      list.value = res.list
      pagination.total = res.total
      pagination.current = res.current
      pagination.size = res.size
    } finally {
      loading.value = false
    }
  }

  const handleSearch = () => {
    pagination.current = 1
    loadList()
  }

  const handleSizeChange = () => {
    pagination.current = 1
    loadList()
  }

  const readBlobMessage = async (blob: Blob) => {
    const text = await blob.text()

    try {
      const data = JSON.parse(text)
      return data.message || data.msg || '导出失败'
    } catch {
      return '导出失败'
    }
  }

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  const handleExport = async () => {
    exportLoading.value = true
    try {
      const blob = await exportAdverseReactionList({
        patient_name: searchForm.patient_name || undefined,
        severity: searchForm.severity,
        pending: route.query.pending === '1' ? '1' : undefined,
        processing_status: searchForm.processing_status || undefined,
        owner_id: searchForm.owner_id,
        project_id: searchForm.project_id,
        group_id: searchForm.group_id,
        as_of: searchForm.as_of || undefined
      })

      if (blob.type.includes('application/json')) {
        ElMessage.error(await readBlobMessage(blob))
        return
      }

      const fileName = `不良反应上报_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.xlsx`
      downloadBlob(blob, fileName)
      ElMessage.success('导出成功')
    } catch (error: any) {
      ElMessage.error(error?.message || '导出失败')
    } finally {
      exportLoading.value = false
    }
  }

  onMounted(() => {
    request.get<typeof owners.value>({ url: '/app/core/admin/index' }).then((data) => {
      owners.value = data
    })
    loadList()
  })
</script>

<style scoped lang="scss">
  .adverse-reaction-page {
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
      margin: 4px 0 0;
      color: var(--el-text-color-secondary);
      font-size: 13px;
    }
  }

  .scope-toolbar {
    padding: 12px 16px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;

    :deep(.el-button + .el-button) {
      margin-left: 0;
    }
  }

  .pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  @media (max-width: 768px) {
    .toolbar {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
