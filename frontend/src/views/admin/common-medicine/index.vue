<template>
  <div class="common-medicine-page">
    <div class="toolbar">
      <div>
        <h2>常用药品</h2>
      </div>
      <div class="actions">
        <ElInput
          v-model.trim="searchForm.keyword"
          placeholder="请输入药品名称、厂家或医保码"
          clearable
          style="width: 260px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <ElSelect
          v-model="searchForm.status"
          placeholder="请选择状态"
          clearable
          style="width: 140px"
          @change="handleSearch"
        >
          <ElOption label="启用" :value="1" />
          <ElOption label="停用" :value="0" />
        </ElSelect>
        <ElButton type="primary" @click="handleSearch">查询</ElButton>
        <ElButton @click="loadList" :loading="loading">刷新</ElButton>
      </div>
    </div>

    <ElCard shadow="never">
      <ElTable :data="list" v-loading="loading" border>
        <ElTableColumn prop="id" label="ID" width="80" />
        <ElTableColumn prop="common_name" label="药品名称" min-width="180" />
        <ElTableColumn prop="company" label="生产厂家" min-width="180" />
        <ElTableColumn prop="specification" label="规格" min-width="150" />
        <ElTableColumn prop="usage" label="服用方式" min-width="120" />
        <ElTableColumn prop="dosage" label="剂量" min-width="120" />
        <ElTableColumn prop="frequency" label="频次/天" width="90" />
        <ElTableColumn prop="ybm" label="医保码" min-width="150" />
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }">
            <ElTag :type="row.status === 1 ? 'success' : 'info'">
              {{ row.status_text }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="openDetail(row as CommonMedicineRecord)"
              >查看</ElButton
            >
            <ElButton link type="warning" @click="handleToggleStatus(row as CommonMedicineRecord)">
              {{ row.status === 1 ? '停用' : '启用' }}
            </ElButton>
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

    <ElDialog v-model="detailVisible" title="常用药品详情" width="760px">
      <div v-if="currentRecord" class="detail-content">
        <div class="detail-grid">
          <div><span>药品名称：</span>{{ currentRecord.common_name || '-' }}</div>
          <div><span>生产厂家：</span>{{ currentRecord.company || '-' }}</div>
          <div><span>规格：</span>{{ currentRecord.specification || '-' }}</div>
          <div><span>服用方式：</span>{{ currentRecord.usage || '-' }}</div>
          <div><span>剂量：</span>{{ currentRecord.dosage || '-' }}</div>
          <div><span>频次/天：</span>{{ currentRecord.frequency || 0 }}</div>
          <div><span>医保码：</span>{{ currentRecord.ybm || '-' }}</div>
          <div><span>状态：</span>{{ currentRecord.status_text || '-' }}</div>
          <div><span>排序：</span>{{ currentRecord.sort_order || 0 }}</div>
          <div><span>创建时间：</span>{{ currentRecord.created_at || '-' }}</div>
          <div class="full">
            <span>用药指导：</span>{{ currentRecord.medication_guidance || '无' }}
          </div>
        </div>
      </div>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessageBox } from 'element-plus'
  import {
    fetchCommonMedicineList,
    toggleCommonMedicineStatus,
    type CommonMedicineRecord
  } from '@/api/common-medicine'

  defineOptions({ name: 'CommonMedicineIndex' })

  const loading = ref(false)
  const detailVisible = ref(false)
  const list = ref<CommonMedicineRecord[]>([])
  const currentRecord = ref<CommonMedicineRecord>()
  const searchForm = reactive({
    keyword: '',
    status: undefined as number | undefined
  })
  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  })

  const loadList = async () => {
    loading.value = true
    try {
      const res = await fetchCommonMedicineList({
        current: pagination.current,
        size: pagination.size,
        keyword: searchForm.keyword || undefined,
        status: searchForm.status
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

  const openDetail = (row: CommonMedicineRecord) => {
    currentRecord.value = row
    detailVisible.value = true
  }

  const handleToggleStatus = async (row: CommonMedicineRecord) => {
    const nextStatus = row.status === 1 ? 0 : 1
    await ElMessageBox.confirm(
      `确认要${nextStatus === 1 ? '启用' : '停用'}【${row.common_name}】吗？`,
      '提示',
      {
        type: 'warning'
      }
    )

    await toggleCommonMedicineStatus(row.id, nextStatus)
    await loadList()
  }

  onMounted(() => {
    loadList()
  })
</script>

<style scoped lang="scss">
  .common-medicine-page {
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
