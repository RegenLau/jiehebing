<template>
  <div class="survey-page">
    <div class="toolbar">
      <div>
        <h2>问卷管理</h2><ElButton type="primary" @click="editor?.open()">新增问卷</ElButton>
      </div>
      <div class="actions">
        <ElInput
          v-model.trim="searchForm.keyword"
          placeholder="请输入模板名称或编码"
          clearable
          style="width: 240px"
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

    <Editor ref="editor" @saved="loadList" />
    <ElCard shadow="never">
      <ElTable :data="list" v-loading="loading" border>
        <ElTableColumn prop="id" label="ID" width="80" />
        <ElTableColumn prop="name" label="问卷名称" min-width="180" />
        <ElTableColumn prop="code" label="模板编码" min-width="180" />

        <ElTableColumn prop="questionCount" label="题目数" width="90" />
        <ElTableColumn prop="answerCount" label="题答案条数" width="90" />
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }">
            <ElTag :type="row.status === 1 ? 'success' : 'info'">
              {{ row.status === 1 ? '启用' : '停用' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="createdAt" label="创建时间" min-width="180" />
        <ElTableColumn label="操作" min-width="260" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="openDetail(row as SurveyRecord)">详情</ElButton
            ><ElButton link type="primary" @click="editor?.open(row.id)">编辑</ElButton
            ><ElButton link type="warning" @click="toggleStatus(row as SurveyRecord)">{{
              row.status === 1 ? '停用' : '启用'
            }}</ElButton>
            <ElButton
              link
              type="primary"
              :loading="exportingId === (row as SurveyRecord).id"
              @click="handleExport(row as SurveyRecord)"
            >
              数据导出
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

    <ElDialog v-model="detailVisible" title="问卷详情" width="900px">
      <div v-loading="detailLoading" class="detail-content" v-if="detailData">
        <div class="detail-base">
          <div><span>问卷名称：</span>{{ detailData.name }}</div>
          <div><span>模板编码：</span>{{ detailData.code }}</div>
          <div><span>建档后第几天可填：</span>{{ detailData.fillableDay }}</div>
          <div><span>状态：</span>{{ detailData.status === 1 ? '启用' : '停用' }}</div>
          <div class="full"><span>问卷说明：</span>{{ detailData.description || '无' }}</div>
        </div>

        <div class="question-list">
          <ElCard
            v-for="question in detailData.questions"
            :key="question.id"
            shadow="never"
            class="question-card"
          >
            <template #header>
              <div class="question-header">
                <span>第 {{ question.questionNo }} 题</span>
                <ElTag size="small">{{ question.type }}</ElTag>
              </div>
            </template>

            <div class="question-title">
              {{ question.title }}
              <ElTag v-if="question.required === 1" type="danger" size="small">必填</ElTag>
            </div>
            <div v-if="question.placeholder" class="question-placeholder">
              占位提示：{{ question.placeholder }}
            </div>

            <div v-if="question.options.length" class="option-list">
              <div v-for="option in question.options" :key="option.id" class="option-item">
                <span>{{ option.label }}</span>
                <div class="option-tags">
                  <ElTag v-if="option.isExclusive" size="small" type="warning">互斥</ElTag>
                  <ElTag v-if="option.triggerInput" size="small" type="success">条件输入</ElTag>
                </div>
              </div>
            </div>
          </ElCard>
        </div>
      </div>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import Editor from './modules/editor.vue'
  import { toggleSurveyStatus } from '@/api/survey'
  import { ElMessageBox } from 'element-plus'
  const editor = ref<InstanceType<typeof Editor>>()
  async function toggleStatus(row: SurveyRecord) {
    try {
      await ElMessageBox.confirm(
        '变更问卷状态不会修改已有答卷和分组安排。',
        '确认' + (row.status === 1 ? '停用' : '启用')
      )
      await toggleSurveyStatus(row.id, row.status === 1 ? 0 : 1)
      await loadList()
    } catch {
      /* 取消或请求错误 */
    }
  }

  import {
    exportSurveyAnswers,
    fetchSurveyDetail,
    fetchSurveyList,
    type SurveyDetail,
    type SurveyRecord
  } from '@/api/survey'
  import { ElMessage } from 'element-plus'

  defineOptions({ name: 'SurveyIndex' })

  const loading = ref(false)
  const detailLoading = ref(false)
  const detailVisible = ref(false)
  const exportingId = ref<number | null>(null)
  const list = ref<SurveyRecord[]>([])
  const detailData = ref<SurveyDetail>()
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
      const res = await fetchSurveyList({
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

  const handleSizeChange = () => {
    pagination.current = 1
    loadList()
  }

  const handleSearch = () => {
    pagination.current = 1
    loadList()
  }

  const openDetail = async (record: SurveyRecord) => {
    detailVisible.value = true
    detailLoading.value = true
    try {
      detailData.value = await fetchSurveyDetail(record.id)
    } finally {
      detailLoading.value = false
    }
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

  const handleExport = async (record: SurveyRecord) => {
    exportingId.value = record.id
    try {
      const blob = await exportSurveyAnswers(record.id)

      if (blob.type.includes('application/json')) {
        ElMessage.error(await readBlobMessage(blob))
        return
      }

      const fileName = `问卷答题数据_${record.code}_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.xlsx`
      downloadBlob(blob, fileName)
      ElMessage.success('导出成功')
    } catch (error: any) {
      ElMessage.error(error?.message || '导出失败')
    } finally {
      exportingId.value = null
    }
  }

  onMounted(() => {
    loadList()
  })
</script>

<style scoped lang="scss">
  .survey-page {
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
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 160px;
  }

  .detail-base {
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

  .question-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .question-card {
    :deep(.el-card__header) {
      padding: 12px 16px;
    }
  }

  .question-header,
  .option-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .question-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .question-placeholder {
    color: #6b7280;
    margin-bottom: 12px;
  }

  .option-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option-item {
    padding: 10px 12px;
    border-radius: 8px;
    background: #f8fafc;
  }

  .option-tags {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
</style>
