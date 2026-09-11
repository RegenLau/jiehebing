<template>
  <div class="scheme-page">
    <template v-if="!isFormPage">
      <div class="toolbar"
        ><h2>用药方案</h2><ElButton type="primary" @click="goToFormPage()">新增方案</ElButton></div
      >
      <ElCard shadow="never">
        <div class="toolbar"
          ><ElInput
            v-model="keyword"
            placeholder="方案名称"
            clearable
            @keyup.enter="search"
          /><ElSelect v-model="status" placeholder="全部状态" clearable @change="search"
            ><ElOption label="启用" :value="1" /><ElOption label="停用" :value="0" /></ElSelect
          ><ElButton @click="search">查询</ElButton></div
        >
        <ElTable v-loading="loading" :data="rows" border
          ><ElTableColumn prop="name" label="方案名称" /><ElTableColumn
            prop="description"
            label="说明"
            show-overflow-tooltip
          /><ElTableColumn prop="version" label="版本" width="100" /><ElTableColumn
            label="状态"
            width="100"
            ><template #default="{ row }"
              ><ElTag :type="row.status === 1 ? 'success' : 'info'" effect="light">{{
                row.status === 1 ? '启用' : '停用'
              }}</ElTag></template
            ></ElTableColumn
          ><ElTableColumn label="操作" width="150"
            ><template #default="{ row }"
              ><ElButton link type="primary" @click="goToFormPage(row.id)">编辑</ElButton
              ><ElButton link type="warning" @click="toggle(row as Scheme)">{{
                row.status === 1 ? '停用' : '启用'
              }}</ElButton></template
            ></ElTableColumn
          ></ElTable
        >
        <ElPagination
          v-model:current-page="current"
          :page-size="10"
          :total="total"
          layout="total,prev,pager,next"
          @current-change="load"
        />
      </ElCard>
    </template>
    <template v-else>
      <div class="form-page__header">
        <ElButton :icon="ArrowLeft" :disabled="saving" @click="backToList">返回列表</ElButton>
        <div class="form-page__actions">
          <ElButton :disabled="saving" @click="backToList">取消</ElButton>
          <ElButton type="primary" :loading="saving" :disabled="formLoading" @click="save"
            >保存方案</ElButton
          >
        </div>
      </div>
      <ElCard v-loading="formLoading" shadow="never" class="form-page__card">
        <div class="form-page__intro">
          <h2>{{ isEditPage ? '编辑用药方案' : '新增用药方案' }}</h2>
          <p>{{ isEditPage ? '修改方案信息与药品明细' : '填写方案信息并添加药品明细' }}</p>
        </div>
        <ElForm label-position="top" :disabled="saving || formLoading">
          <div class="grid"
            ><ElFormItem label="方案名称（必填）"
              ><ElInput v-model="form.name" maxlength="100" /></ElFormItem
            ><ElFormItem label="说明"
              ><ElInput v-model="form.description" maxlength="1000" /></ElFormItem
            ><ElFormItem label="提前提醒取药（天）"
              ><ElInputNumber v-model="form.advance_days" :min="0" :max="3650" /></ElFormItem
          ></div>
          <MedicationEditor
            v-if="!formLoading"
            ref="medicationEditor"
            v-model="medication"
            context="scheme"
            :sources="[]"
            :group-name="form.name"
            :readonly="false"
            :disabled="saving"
            :advance-days="form.advance_days"
          />
          <ElFormItem v-if="isEditPage" label="修改原因（必填）"
            ><ElInput v-model="form.reason" maxlength="300"
          /></ElFormItem>
        </ElForm>
      </ElCard>
    </template>
  </div>
</template>
<script setup lang="ts">
  import { computed, nextTick, ref, watch } from 'vue'
  import { ArrowLeft } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useRoute, useRouter } from 'vue-router'
  import request from '@/utils/http'
  import type { Drug, Medication } from '@/api/project'
  import MedicationEditor from '@/components/business/medication-editor.vue'
  interface Scheme {
    id?: number
    name: string
    description: string
    version?: string
    status: number
    treatment_days: number
    pickup_days: number
    advance_days: number
    prescription_url?: string
    pickup_mode?: 'manual' | 'quantity'
    drugs: (Drug & { quantity: number })[]
    reason: string
  }
  const blank = (): Scheme => ({
    name: '',
    description: '',
    status: 1,
    treatment_days: 30,
    pickup_days: 30,
    advance_days: 3,
    drugs: [],
    reason: ''
  })
  const rows = ref<Scheme[]>([]),
    form = ref<Scheme>(blank()),
    keyword = ref(''),
    status = ref<number>(),
    current = ref(1),
    total = ref(0),
    loading = ref(false),
    formLoading = ref(false),
    saving = ref(false)
  const medication = ref<Medication | null>(null)
  const medicationEditor = ref<InstanceType<typeof MedicationEditor>>()
  const route = useRoute()
  const router = useRouter()
  const isFormPage = computed(() => route.query.mode === 'create' || route.query.mode === 'edit')
  const isEditPage = computed(() => route.query.mode === 'edit')
  async function load() {
    loading.value = true
    try {
      const data = await request.get<{ list: Scheme[]; total: number }>({
        url: '/app/core/medication-scheme/index',
        params: { keyword: keyword.value, status: status.value, current: current.value, size: 10 }
      })
      rows.value = data.list
      total.value = data.total
    } finally {
      loading.value = false
    }
  }
  function search() {
    current.value = 1
    void load()
  }
  async function goToFormPage(id?: number) {
    await router.push({
      path: route.path,
      query: id ? { mode: 'edit', id: String(id) } : { mode: 'create' }
    })
  }
  async function backToList() {
    await router.replace({ path: route.path })
  }
  async function prepareFormPage() {
    form.value = blank()
    const queryId = Array.isArray(route.query.id) ? route.query.id[0] : route.query.id
    const id = Number(queryId)
    if (isEditPage.value && (!Number.isInteger(id) || id <= 0)) {
      ElMessage.warning('缺少有效的用药方案编号')
      await backToList()
      return
    }
    formLoading.value = true
    try {
      if (isEditPage.value) {
        const row = await request.get<Scheme>({
          url: '/app/core/medication-scheme/detail',
          params: { id }
        })
        form.value = {
          ...blank(),
          ...row,
          reason: '',
          drugs: row.drugs.map((d) => ({ ...d, quantity: d.quantity || 30 }))
        }
      }
      medication.value = {
        id: form.value.id || 0,
        snapshot: { ...form.value, id: form.value.id || 0 },
        treatment_days: form.value.treatment_days,
        pickup_days: form.value.pickup_days,
        advance_days: form.value.advance_days,
        prescription_url: form.value.prescription_url,
        quantities: form.value.drugs.map((d) => ({ drug_id: d.drug_id, quantity: d.quantity }))
      }
      await nextTick()
      window.scrollTo({ top: 0 })
    } finally {
      formLoading.value = false
    }
  }
  async function save() {
    if (!form.value.name.trim()) {
      ElMessage.warning('请填写方案名称')
      return
    }
    if (!medicationEditor.value?.validate()) return
    if (!medication.value?.drugs?.length) {
      ElMessage.warning('请至少添加 1 个药品')
      return
    }
    if (isEditPage.value && !form.value.reason.trim()) {
      ElMessage.warning('请填写修改原因')
      return
    }
    saving.value = true
    try {
      await request.post({
        url: '/app/core/medication-scheme/save',
        params: {
          ...form.value,
          drugs: medication.value.drugs,
          treatment_days: medication.value.treatment_days,
          pickup_days: medication.value.pickup_days,
          pickup_mode: 'quantity',
          prescription_url: medication.value.prescription_url
        },
        showSuccessMessage: true
      })
      await backToList()
    } finally {
      saving.value = false
    }
  }
  async function toggle(row: Scheme) {
    try {
      const { value } = await ElMessageBox.prompt(
        '请填写启停原因。已有分组及患者方案不会自动改变。',
        '变更方案状态',
        { inputValidator: (v) => Boolean(v?.trim()) || '请填写原因' }
      )
      await request.post({
        url: '/app/core/medication-scheme/status',
        params: {
          id: row.id,
          version: row.version,
          status: row.status === 1 ? 0 : 1,
          reason: value
        },
        showSuccessMessage: true
      })
      await load()
    } catch {
      /* 取消或请求错误 */
    }
  }
  watch(
    () => [route.query.mode, route.query.id],
    () => {
      if (isFormPage.value) void prepareFormPage()
      else void load()
    },
    { immediate: true }
  )
</script>
<style scoped>
  .scheme-page {
    padding: 20px;
  }

  .toolbar {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-bottom: 20px;
  }

  .toolbar h2 {
    flex: 1;
  }

  .toolbar .el-input,
  .toolbar .el-select {
    max-width: 300px;
  }

  .form-page__header {
    display: flex;
    gap: 24px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .form-page__intro {
    margin-bottom: 28px;
  }

  .form-page__intro h2,
  .form-page__intro p {
    margin: 0;
  }

  .form-page__intro p {
    margin-top: 8px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .form-page__actions {
    display: flex;
    gap: 12px;
  }

  .form-page__card {
    min-height: 420px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 16px;
  }

  .el-pagination {
    margin-top: 20px;
  }

  @media (width <= 700px) {
    .form-page__header {
      flex-direction: column;
      align-items: stretch;
    }

    .form-page__actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
