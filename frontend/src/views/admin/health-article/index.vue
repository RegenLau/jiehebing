<template>
  <div class="health-article-page">
    <div class="toolbar">
      <div>
        <h2>健康科普管理</h2>
        <p>支持文章列表、搜索、新增、编辑和上下架。</p>
      </div>
      <div class="actions">
        <ElInput
          v-model.trim="searchForm.keyword"
          placeholder="请输入标题或摘要"
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
          <ElOption label="上架" :value="1" />
          <ElOption label="下架" :value="0" />
        </ElSelect>
        <ElButton type="primary" @click="handleSearch">查询</ElButton>
        <ElButton @click="loadList" :loading="loading">刷新</ElButton>
        <ElButton type="primary" @click="openCreate">新增文章</ElButton>
      </div>
    </div>

    <ElCard shadow="never">
      <ElTable :data="list" v-loading="loading" border>
        <ElTableColumn prop="id" label="ID" width="80" />
        <ElTableColumn prop="title" label="标题" min-width="220" />
        <ElTableColumn prop="summary" label="摘要" min-width="260" show-overflow-tooltip />
        <ElTableColumn prop="view_count" label="浏览量" width="90" />
        <ElTableColumn prop="sort" label="排序" width="90" />
        <ElTableColumn prop="published_at" label="发布时间" min-width="170" />
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }">
            <ElTag :type="row.status === 1 ? 'success' : 'info'">
              {{ row.status === 1 ? '上架' : '下架' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" min-width="220" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="openDetail(row)">详情</ElButton>
            <ElButton link type="primary" @click="openEdit(row)">编辑</ElButton>
            <ElButton link type="warning" @click="handleToggleStatus(row)">
              {{ row.status === 1 ? '下架' : '上架' }}
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

    <ElDialog v-model="detailVisible" title="文章详情" width="920px">
      <div v-loading="detailLoading" class="detail-content" v-if="detailData">
        <div class="detail-base">
          <div><span>标题：</span>{{ detailData.title }}</div>
          <div><span>发布时间：</span>{{ detailData.published_at || '-' }}</div>
          <div><span>浏览量：</span>{{ detailData.view_count }}</div>
          <div><span>状态：</span>{{ detailData.status === 1 ? '上架' : '下架' }}</div>
          <div class="full"><span>封面：</span>{{ detailData.cover || '无' }}</div>
          <div class="full"><span>摘要：</span>{{ detailData.summary || '无' }}</div>
        </div>
        <ElCard shadow="never">
          <div class="article-html" v-html="detailData.content || ''"></div>
        </ElCard>
      </div>
    </ElDialog>

    <ElDialog v-model="formVisible" :title="isEdit ? '编辑文章' : '新增文章'" width="980px">
      <ElForm ref="formRef" :model="formData" :rules="rules" label-width="100px">
        <ElFormItem label="文章标题" prop="title">
          <ElInput v-model.trim="formData.title" placeholder="请输入文章标题" />
        </ElFormItem>
        <ElFormItem label="封面地址">
          <ElInput v-model.trim="formData.cover" placeholder="请输入封面图片地址" />
        </ElFormItem>
        <ElFormItem label="文章摘要" prop="summary">
          <ElInput
            v-model.trim="formData.summary"
            type="textarea"
            :rows="3"
            maxlength="300"
            show-word-limit
            placeholder="请输入文章摘要"
          />
        </ElFormItem>
        <ElFormItem label="发布时间">
          <ElDatePicker
            v-model="formData.published_at"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="请选择发布时间"
            style="width: 260px"
          />
        </ElFormItem>
        <ElFormItem label="排序">
          <ElInputNumber v-model="formData.sort" :min="0" />
        </ElFormItem>
        <ElFormItem label="状态">
          <ElSwitch v-model="formData.status" :active-value="1" :inactive-value="0" />
        </ElFormItem>
        <ElFormItem label="文章内容" prop="content">
          <sa-editor v-model="formData.content" height="360px" />
        </ElFormItem>
      </ElForm>

      <template #footer>
        <ElButton @click="formVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submitForm">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessageBox } from 'element-plus'
  import {
    fetchHealthArticleDetail,
    fetchHealthArticleList,
    saveHealthArticle,
    toggleHealthArticleStatus,
    type HealthArticleRecord
  } from '@/api/health-article'

  defineOptions({ name: 'HealthArticleIndex' })

  const loading = ref(false)
  const detailLoading = ref(false)
  const detailVisible = ref(false)
  const formVisible = ref(false)
  const submitting = ref(false)
  const isEdit = ref(false)
  const formRef = ref<FormInstance>()
  const list = ref<HealthArticleRecord[]>([])
  const detailData = ref<HealthArticleRecord>()
  const searchForm = reactive({
    keyword: '',
    status: undefined as number | undefined
  })
  const pagination = reactive({
    current: 1,
    size: 10,
    total: 0
  })
  const formData = reactive({
    id: undefined as number | undefined,
    title: '',
    cover: '',
    summary: '',
    content: '',
    sort: 0,
    status: 1,
    published_at: ''
  })

  const rules: FormRules = {
    title: [{ required: true, message: '请输入文章标题', trigger: 'blur' }],
    summary: [{ required: true, message: '请输入文章摘要', trigger: 'blur' }],
    content: [{ required: true, message: '请输入文章内容', trigger: 'blur' }]
  }

  const resetForm = () => {
    formData.id = undefined
    formData.title = ''
    formData.cover = ''
    formData.summary = ''
    formData.content = ''
    formData.sort = 0
    formData.status = 1
    formData.published_at = ''
  }

  const loadList = async () => {
    loading.value = true
    try {
      const res = await fetchHealthArticleList({
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

  const openCreate = () => {
    isEdit.value = false
    resetForm()
    formVisible.value = true
  }

  const openEdit = async (row: any) => {
    const record = row as HealthArticleRecord
    isEdit.value = true
    formVisible.value = true
    submitting.value = false
    const detail = await fetchHealthArticleDetail(record.id)
    formData.id = detail.id
    formData.title = detail.title
    formData.cover = detail.cover
    formData.summary = detail.summary
    formData.content = detail.content || ''
    formData.sort = detail.sort
    formData.status = detail.status
    formData.published_at = detail.published_at
  }

  const openDetail = async (row: any) => {
    const record = row as HealthArticleRecord
    detailVisible.value = true
    detailLoading.value = true
    try {
      detailData.value = await fetchHealthArticleDetail(record.id)
    } finally {
      detailLoading.value = false
    }
  }

  const handleToggleStatus = async (row: any) => {
    const record = row as HealthArticleRecord
    const nextStatus = record.status === 1 ? 0 : 1
    await ElMessageBox.confirm(
      `确定要${nextStatus === 1 ? '上架' : '下架'}文章【${record.title}】吗？`,
      '提示',
      { type: 'warning' }
    )
    await toggleHealthArticleStatus(record.id, nextStatus)
    await loadList()
    if (detailData.value?.id === record.id) {
      detailData.value.status = nextStatus
    }
  }

  const submitForm = async () => {
    if (!formRef.value) return
    await formRef.value.validate()

    submitting.value = true
    try {
      await saveHealthArticle({
        id: formData.id,
        title: formData.title,
        cover: formData.cover || undefined,
        summary: formData.summary,
        content: formData.content,
        sort: formData.sort,
        status: formData.status,
        published_at: formData.published_at || undefined
      })
      formVisible.value = false
      await loadList()
    } finally {
      submitting.value = false
    }
  }

  onMounted(() => {
    loadList()
  })
</script>

<style scoped lang="scss">
  .health-article-page {
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
      color: #6b7280;
      font-size: 14px;
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

  .article-html {
    line-height: 1.8;
    color: #374151;
  }

  @media (max-width: 1200px) {
    .detail-base {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .toolbar {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
