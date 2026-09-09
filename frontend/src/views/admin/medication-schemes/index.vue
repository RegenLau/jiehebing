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
        <div class="form-page__title">
          <ElButton :icon="ArrowLeft" :disabled="saving" @click="backToList">返回列表</ElButton>
          <div>
            <h2>{{ isEditPage ? '编辑用药方案' : '新增用药方案' }}</h2>
            <p>{{ isEditPage ? '修改方案信息与药品明细' : '填写方案信息并添加药品明细' }}</p>
          </div>
        </div>
        <div class="form-page__actions">
          <ElButton :disabled="saving" @click="backToList">取消</ElButton>
          <ElButton type="primary" :loading="saving" :disabled="formLoading" @click="save"
            >保存方案</ElButton
          >
        </div>
      </div>
      <ElCard v-loading="formLoading" shadow="never" class="form-page__card">
        <ElForm label-position="top" :disabled="saving || formLoading">
          <div class="grid"
            ><ElFormItem label="方案名称（必填）"
              ><ElInput v-model="form.name" maxlength="100" /></ElFormItem
            ><ElFormItem label="说明"
              ><ElInput v-model="form.description" maxlength="1000" /></ElFormItem
            ><ElFormItem label="默认治疗天数"
              ><ElInputNumber v-model="form.treatment_days" :min="1" :max="3650" /></ElFormItem
            ><ElFormItem label="默认取药周期（天）"
              ><ElInputNumber v-model="form.pickup_days" :min="1" :max="3650" /></ElFormItem
            ><ElFormItem label="提前提醒取药（天）"
              ><ElInputNumber
                v-model="form.advance_days"
                :min="0"
                :max="form.pickup_days" /></ElFormItem
          ></div>
          <div class="drug-entry"
            ><div class="drug-entry__heading"
              ><h3>添加药品</h3
              ><p>{{
                isEditPage ? '从药品库逐个添加' : '可通过处方识别批量录入，或从药品库逐个添加'
              }}</p></div
            ><div class="drug-entry__actions"
              ><ElButton
                v-if="!isEditPage"
                type="primary"
                plain
                :icon="Camera"
                @click="openPrescriptionRecognition"
                >处方识别</ElButton
              ><div class="single-drug-entry"
                ><ElSelect
                  ref="medicineSelect"
                  v-model="medicineId"
                  filterable
                  placeholder="选择常用药品"
                  ><ElOption
                    v-for="m in medicines"
                    :key="m.id"
                    :label="m.common_name + ' · ' + m.specification"
                    :value="m.id"
                    :disabled="m.status !== 1" /></ElSelect
                ><ElButton :icon="Plus" @click="addDrug">添加单个药</ElButton></div
              ></div
            ></div
          >
          <div v-for="(drug, index) in form.drugs" :key="drug.drug_id" class="drug"
            ><div class="toolbar"
              ><strong>{{ drug.name }} · {{ drug.specification }}</strong
              ><ElButton link type="danger" @click="form.drugs.splice(index, 1)"
                >移除</ElButton
              ></div
            ><div class="grid"
              ><ElFormItem label="单次用量"><ElInput v-model="drug.dose" /></ElFormItem
              ><ElFormItem label="单位"><ElInput v-model="drug.unit" /></ElFormItem
              ><ElFormItem label="频次"
                ><ElInput v-model="drug.frequency" placeholder="例如每日2次" /></ElFormItem
              ><ElFormItem label="服药时间"
                ><ElInput v-model="drug.times" placeholder="08:00,20:00" /></ElFormItem
              ><ElFormItem label="默认首次发药数量"
                ><ElInputNumber v-model="drug.quantity" :min="1" :max="100000" /></ElFormItem
              ><ElFormItem label="注意事项"><ElInput v-model="drug.precautions" /></ElFormItem></div
          ></div>
          <ElEmpty v-if="!form.drugs.length" description="请添加药品" />
          <ElFormItem v-if="isEditPage" label="修改原因（必填）"
            ><ElInput v-model="form.reason" maxlength="300"
          /></ElFormItem>
        </ElForm>
      </ElCard>
    </template>
    <ElDialog
      v-model="prescriptionVisible"
      title="处方识别"
      width="min(640px, 92vw)"
      append-to-body
      :close-on-click-modal="false"
      @closed="resetPrescription"
    >
      <div class="prescription-dialog">
        <ElAlert
          title="请上传清晰、完整的处方图片，识别结果需由医务人员逐项核对后再加入方案。"
          type="warning"
          show-icon
          :closable="false"
        />
        <ElUpload
          v-model:file-list="prescriptionFiles"
          drag
          accept="image/jpeg,image/png"
          :auto-upload="false"
          :limit="1"
          :on-change="validatePrescription"
          :on-exceed="handlePrescriptionExceed"
        >
          <ElIcon class="prescription-upload__icon"><UploadFilled /></ElIcon>
          <div class="el-upload__text">将处方图片拖到此处，或<em>点击选择</em></div>
          <template #tip>
            <div class="el-upload__tip">支持 JPG、PNG，单张不超过 10MB</div>
          </template>
        </ElUpload>
        <ElAlert
          title="当前本地演示环境尚未接入真实处方识别服务，不会生成模拟药品。"
          description="可返回新增方案后，通过“添加单个药”继续录入。"
          type="info"
          show-icon
          :closable="false"
        />
      </div>
      <template #footer>
        <ElButton @click="prescriptionVisible = false">关闭</ElButton>
        <ElButton type="primary" @click="switchToSingleDrug">添加单个药</ElButton>
      </template>
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import { computed, nextTick, ref, watch } from 'vue'
  import { ArrowLeft, Camera, Plus, UploadFilled } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { UploadFile, UploadFiles, UploadUserFile } from 'element-plus'
  import { useRoute, useRouter } from 'vue-router'
  import request from '@/utils/http'
  import { fetchCommonMedicineList, type CommonMedicineRecord } from '@/api/common-medicine'
  import type { Drug } from '@/api/project'
  interface Scheme {
    id?: number
    name: string
    description: string
    version?: string
    status: number
    treatment_days: number
    pickup_days: number
    advance_days: number
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
    saving = ref(false),
    prescriptionVisible = ref(false),
    prescriptionFiles = ref<UploadUserFile[]>([]),
    medicines = ref<CommonMedicineRecord[]>([]),
    medicineId = ref<number>(),
    medicineSelect = ref()
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
    prescriptionVisible.value = false
    await router.replace({ path: route.path })
  }
  async function prepareFormPage() {
    medicineId.value = undefined
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
      const all: CommonMedicineRecord[] = []
      let n = 1
      while (true) {
        const p = await fetchCommonMedicineList({ current: n++, size: 100 })
        all.push(...p.list)
        if (all.length >= p.total) break
      }
      medicines.value = all
      await nextTick()
      window.scrollTo({ top: 0 })
    } finally {
      formLoading.value = false
    }
  }
  function addDrug() {
    const m = medicines.value.find((m) => m.id === medicineId.value)
    if (!m) return
    if (form.value.drugs.some((d) => d.drug_id === m.id)) {
      ElMessage.warning('已添加该药品')
      return
    }
    form.value.drugs.push({
      drug_id: m.id,
      name: m.common_name,
      specification: m.specification,
      dose: m.dosage_value,
      unit: m.dosage_unit,
      frequency: '每日1次',
      times: '08:00',
      precautions: m.medication_guidance,
      quantity: 30
    })
    medicineId.value = undefined
  }
  function openPrescriptionRecognition() {
    prescriptionFiles.value = []
    prescriptionVisible.value = true
  }
  function validatePrescription(file: UploadFile, files: UploadFiles) {
    const raw = file.raw
    const isSupported = Boolean(raw && ['image/jpeg', 'image/png'].includes(raw.type))
    const isWithinLimit = Boolean(raw && raw.size <= 10 * 1024 * 1024)
    if (!isSupported || !isWithinLimit) {
      prescriptionFiles.value = files.filter((item) => item.uid !== file.uid)
      ElMessage.warning(isSupported ? '处方图片不能超过 10MB' : '处方识别仅支持 JPG、PNG 图片')
    }
  }
  function handlePrescriptionExceed() {
    ElMessage.warning('每次仅支持选择 1 张处方图片')
  }
  function resetPrescription() {
    prescriptionFiles.value = []
  }
  async function switchToSingleDrug() {
    prescriptionVisible.value = false
    await nextTick()
    medicineSelect.value?.focus?.()
  }
  async function save() {
    if (!form.value.name.trim()) {
      ElMessage.warning('请填写方案名称')
      return
    }
    if (!form.value.drugs.length) {
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
        params: form.value,
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
      if (!isFormPage.value || isEditPage.value) prescriptionVisible.value = false
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

  .form-page__title {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .form-page__title h2,
  .form-page__title p {
    margin: 0;
  }

  .form-page__title p {
    margin-top: 4px;
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

  .drug-entry {
    padding: 16px;
    margin: 4px 0 20px;
    background: var(--el-fill-color-extra-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .drug-entry__heading {
    margin-bottom: 12px;
  }

  .drug-entry__heading h3,
  .drug-entry__heading p {
    margin: 0;
  }

  .drug-entry__heading h3 {
    font-size: 16px;
  }

  .drug-entry__heading p {
    margin-top: 4px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .drug-entry__actions,
  .single-drug-entry {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .single-drug-entry {
    flex: 1;
  }

  .single-drug-entry .el-select {
    width: min(360px, 100%);
  }

  .prescription-dialog {
    display: grid;
    gap: 20px;
  }

  .prescription-upload__icon {
    margin-bottom: 12px;
    font-size: 48px;
    color: var(--el-text-color-placeholder);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 16px;
  }

  .drug {
    padding: 16px;
    margin: 16px 0;
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
  }

  .el-pagination {
    margin-top: 20px;
  }

  @media (width <= 700px) {
    .form-page__header,
    .form-page__title {
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

    .drug-entry__actions,
    .single-drug-entry {
      flex-direction: column;
      align-items: stretch;
    }

    .single-drug-entry .el-select {
      width: 100%;
    }
  }
</style>
