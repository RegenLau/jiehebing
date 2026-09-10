<template>
  <div class="adverse-reaction-page">
    <div class="toolbar">
      <div>
        <h2>不良反应上报</h2>
      </div>
      <div class="actions">
        <ElInput
          v-model.trim="searchForm.patient_name"
          placeholder="请输入患者姓名"
          clearable
          style="width: 220px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <ElSelect
          v-model="searchForm.severity"
          placeholder="请选择严重程度"
          clearable
          style="width: 160px"
          @change="handleSearch"
        >
          <ElOption label="轻度" :value="1" />
          <ElOption label="中度" :value="2" />
          <ElOption label="重度" :value="3" />
        </ElSelect>
        <ElButton type="primary" @click="handleSearch">查询</ElButton>
        <ElButton @click="loadList" :loading="loading">刷新</ElButton>
        <ElButton type="primary" @click="handleExport" :loading="exportLoading"
          >导出 Excel</ElButton
        >
      </div>
    </div>

    <Assessment ref="assessment" @saved="loadList" />
    <ElCard shadow="never">
      <ElTable :data="list" v-loading="loading" border>
        <ElTableColumn prop="id" label="ID" width="80" />
        <ElTableColumn prop="patient_name" label="患者姓名" min-width="120" fixed="left" />
        <ElTableColumn prop="patient_mobile" label="手机号" min-width="140" />
        <ElTableColumn prop="project_name" label="参与项目" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.project_name || '未参与项目' }}</template>
        </ElTableColumn>
        <ElTableColumn prop="group_name" label="入组名称" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.group_name || '未入组' }}</template>
        </ElTableColumn>
        <ElTableColumn prop="occurred_at" label="发生时间" min-width="160" />
        <ElTableColumn
          prop="symptom_summary"
          label="主要症状"
          min-width="220"
          show-overflow-tooltip
        />
        <ElTableColumn label="严重程度" width="100">
          <template #default="{ row }">
            <ElTag :type="severityTagType(row.severity)">
              {{ row.severity_text }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="处理状态" width="100"
          ><template #default="{ row }">{{
            row.processing_status || '待处理'
          }}</template></ElTableColumn
        ><ElTableColumn prop="created_at" label="上报时间" min-width="180" />
        <ElTableColumn label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="openDetail(row as AdverseReactionRecord)"
              >查看</ElButton
            ><ElButton link type="primary" @click="assessment?.open(row.id)">评估/跟进</ElButton>
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

    <ElDialog v-model="detailVisible" title="不良反应详情" width="720px">
      <div v-if="currentRecord" class="detail-content">
        <div class="detail-grid">
          <div><span>患者姓名：</span>{{ currentRecord.patient_name || '-' }}</div>
          <div><span>手机号：</span>{{ currentRecord.patient_mobile || '-' }}</div>
          <div><span>参与项目：</span>{{ currentRecord.project_name || '未参与项目' }}</div>
          <div><span>入组名称：</span>{{ currentRecord.group_name || '未入组' }}</div>
          <div><span>发生时间：</span>{{ currentRecord.occurred_at || '-' }}</div>
          <div>
            <span>严重程度：</span>
            <ElTag :type="severityTagType(currentRecord.severity)">
              {{ currentRecord.severity_text || '-' }}
            </ElTag>
          </div>
          <div class="full"><span>主要症状：</span>{{ currentRecord.symptom_summary || '-' }}</div>
          <div class="full">
            <span>症状描述：</span>{{ currentRecord.symptom_description || '无' }}
          </div>
          <div class="full"><span>处理建议：</span>{{ currentRecord.advice_text || '无' }}</div>
        </div>
      </div>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { useRoute } from 'vue-router'
  const route = useRoute()
  watch(
    () => route.fullPath,
    () => {
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
  const detailVisible = ref(false)
  const list = ref<AdverseReactionRecord[]>([])
  const currentRecord = ref<AdverseReactionRecord>()
  const searchForm = reactive({
    patient_name: '',
    severity: undefined as number | undefined
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
        severity: searchForm.severity
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

  const openDetail = (row: AdverseReactionRecord) => {
    currentRecord.value = row
    detailVisible.value = true
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
        severity: searchForm.severity
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
  }

  .actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .detail-content {
    min-height: 120px;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 20px;

    span {
      color: #6b7280;
    }

    .full {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 768px) {
    .toolbar {
      flex-direction: column;
      align-items: flex-start;
    }

    .detail-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
