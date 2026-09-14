<template>
  <div class="medication-editor">
    <div class="course-panel">
      <div class="course-title"
        ><h3>疗程与取药</h3><p>根据各药品的用量自动计算，以最早用尽的药品安排取药。</p></div
      >
      <div class="course-fields">
        <ElFormItem label="治疗天数">
          <ElInputNumber
            v-model="treatmentDays"
            :min="1"
            :max="3650"
            :precision="0"
            :disabled="readonly || disabled"
            @change="sync"
          />
          <span class="unit-suffix">天</span>
        </ElFormItem>
        <div class="calculated-cycle"
          ><span>预计取药周期</span
          ><strong>{{ cards.length ? `${pickupDays} 天` : '待添加药品' }}</strong
          ><small>不超过治疗天数</small></div
        >
      </div>
      <ElFormItem
        v-if="!readonly && context === 'group'"
        label="从通用方案带入（可选）"
        class="template-select"
      >
        <ElSelect
          :model-value="templateId || undefined"
          placeholder="选择已有方案，或直接添加药品"
          filterable
          :disabled="disabled"
          @change="useTemplate"
        >
          <ElOption
            v-for="source in sources"
            :key="source.id"
            :label="source.name"
            :value="source.id"
            :disabled="source.status !== 1"
          />
        </ElSelect>
      </ElFormItem>
    </div>

    <section v-if="!readonly" class="add-panel">
      <h3>{{ context === 'scheme' ? '药品添加方式' : '关键词搜索添加药品' }}</h3>
      <ElTabs v-model="addMethod" class="add-tabs">
        <ElTabPane v-if="context === 'scheme'" label="上传处方图片" name="prescription">
          <div class="prescription-content">
            <img
              v-if="previewUrl"
              :src="previewUrl"
              class="prescription-preview"
              alt="已选择的处方图片"
            />
            <ElIcon v-else :size="42" class="upload-icon"><Picture /></ElIcon>
            <p class="upload-title">{{
              selectedFile ? selectedFile.name : '先选择处方图片，再提交识别'
            }}</p>
            <p class="upload-description"
              >识别结果会在提交后生成药品卡片，确认全部药品后才能保存用药方案。</p
            >
            <ElUpload
              accept="image/png,image/jpeg,image/gif"
              :auto-upload="false"
              :show-file-list="false"
              :on-change="selectImage"
              :disabled="disabled || recognizing"
            >
              <ElButton :icon="Picture" class="select-image" :disabled="disabled || recognizing">{{
                selectedFile ? '重新选择处方图片' : '选择处方图片'
              }}</ElButton>
            </ElUpload>
            <ElButton
              type="primary"
              :icon="Upload"
              class="recognize-button"
              :disabled="!selectedFile || disabled"
              :loading="recognizing"
              @click="recognize"
              >提交识别</ElButton
            >
            <small class="mock-note"
              >当前为本地演示识别，结果需人工核对；支持 JPG、PNG、GIF，最大 10 MB。</small
            >
          </div>
        </ElTabPane>
        <ElTabPane label="关键词搜索" name="search">
          <div class="search-toolbar"
            ><ElInput
              v-model="keyword"
              placeholder="输入药品名称或生产厂家"
              clearable
              :disabled="disabled"
              @keyup.enter="search"
            /><ElButton
              type="primary"
              :icon="Search"
              :loading="searching"
              :disabled="disabled"
              @click="search"
              >搜索药品</ElButton
            ></div
          >
          <div v-loading="searching" class="search-results">
            <p v-if="!searched" class="empty-tip">输入关键词，从常用药品中搜索并添加。</p>
            <p v-else-if="!results.length" class="empty-tip">未找到相关药品，请更换关键词。</p>
            <div v-for="medicine in results" :key="medicine.id" class="search-result">
              <div
                ><strong>{{ medicine.common_name }}</strong
                ><p>{{
                  [medicine.specification, medicine.company].filter(Boolean).join(' · ')
                }}</p></div
              >
              <ElButton
                :disabled="disabled || cards.some((d) => d.drug_id === medicine.id)"
                type="primary"
                plain
                @click="addMedicine(medicine)"
                >{{
                  cards.some((d) => d.drug_id === medicine.id) ? '已添加' : '添加药品'
                }}</ElButton
              >
            </div>
            <ElPagination
              v-if="resultTotal > 8"
              v-model:current-page="searchPage"
              :page-size="8"
              :total="resultTotal"
              layout="prev, pager, next"
              @current-change="runSearch"
            />
          </div>
        </ElTabPane>
      </ElTabs>
    </section>

    <div v-if="cards.length" class="cards-summary"
      ><span>已添加 {{ cards.length }} 种药品</span
      ><span>{{ confirmedCount }} / {{ cards.length }} 已确认</span></div
    >
    <ElEmpty v-if="readonly && !cards.length" description="尚未配置分组药品" :image-size="64" />
    <section v-for="(drug, index) in cards" :key="drug.drug_id" class="drug-card">
      <header class="drug-card-heading">
        <div class="drug-card-title"
          ><h3>药品 {{ index + 1 }}</h3
          ><ElTag :type="drug.confirmed ? 'success' : 'warning'" effect="light">{{
            drug.confirmed ? '已确认' : '待确认'
          }}</ElTag></div
        >
        <div class="drug-card-heading-tools">
          <div v-if="!readonly" class="drug-card-actions"
            ><ElButton
              type="primary"
              :disabled="disabled || drug.confirmed"
              @click="confirm(drug, index)"
              >{{ drug.confirmed ? '已确认药品' : '确认药品' }}</ElButton
            ><ElButton type="danger" plain :disabled="disabled" @click="remove(index)"
              >删除</ElButton
            ></div
          >
          <div class="card-supply"
            ><span>预计可用</span><strong>{{ supplyText(drug) }}</strong></div
          >
        </div>
      </header>
      <div class="drug-card-body">
        <div class="drug-identity">
          <ElFormItem label="药品名称"
            ><ElInput
              v-model="drug.name"
              maxlength="100"
              :disabled="readonly || disabled"
              :aria-label="`药品${index + 1}名称`"
              @input="changeDrug(drug)"
          /></ElFormItem>
          <ElFormItem label="规格"
            ><ElInput
              v-model="drug.specification"
              maxlength="100"
              :disabled="readonly || disabled"
              :aria-label="`药品${index + 1}规格`"
              @input="changeDrug(drug)"
          /></ElFormItem>
          <ElFormItem label="首次发放药品量">
            <div class="quantity-input">
              <ElInputNumber
                v-model="drug.quantity"
                :controls="false"
                :min="1"
                :max="100000"
                :precision="0"
                :disabled="readonly || disabled"
                :aria-label="`药品${index + 1}首次发放药品量`"
                @change="changeDrug(drug)"
              />
              <ElInput
                v-model="drug.unit"
                maxlength="20"
                placeholder="单位"
                :disabled="readonly || disabled"
                :aria-label="`药品${index + 1}药品量剂量单位`"
                @input="changeDrug(drug)"
              />
            </div>
          </ElFormItem>
        </div>
        <div class="dose-line">
          <ElFormItem label="每次剂量"
            ><ElInput
              v-model="drug.dose"
              inputmode="decimal"
              :disabled="readonly || disabled"
              :aria-label="`药品${index + 1}每次剂量`"
              @input="changeDrug(drug)"
          /></ElFormItem>
          <ElFormItem label="剂量单位"
            ><ElInput
              v-model="drug.unit"
              :disabled="readonly || disabled"
              :aria-label="`药品${index + 1}剂量单位`"
              @input="changeDrug(drug)"
              ><template #append>/次</template></ElInput
            ></ElFormItem
          >
        </div>
        <ElFormItem label="每日次数" class="frequency-field">
          <ElRadioGroup
            v-model="drug.daily_count"
            class="segmented"
            :disabled="readonly || disabled"
            :aria-label="`药品${index + 1}每日次数`"
            @change="changeFrequency(drug)"
          >
            <ElRadioButton v-for="count in [1, 2, 3, 4]" :key="count" :value="count"
              >每日{{ count }}次</ElRadioButton
            >
          </ElRadioGroup>
        </ElFormItem>
        <div class="reminder-heading"
          ><span>每次提醒时间</span><small>根据每日次数自动展开，保存后同步到预览</small></div
        >
        <div v-for="(reminder, slot) in drug.reminders" :key="slot" class="reminder-row">
          <strong>第 {{ slot + 1 }} 次</strong>
          <ElTimePicker
            v-model="reminder.time"
            format="HH:mm"
            value-format="HH:mm"
            :clearable="false"
            :disabled="readonly || disabled"
            :aria-label="`药品${index + 1}第${slot + 1}次提醒时间`"
            @change="changeDrug(drug)"
          />
          <ElRadioGroup
            v-model="reminder.timing"
            class="segmented timing"
            :disabled="readonly || disabled"
            :aria-label="`药品${index + 1}第${slot + 1}次服药时机`"
            @change="changeDrug(drug)"
          >
            <ElRadioButton v-for="timing in timings" :key="timing" :value="timing">{{
              timing
            }}</ElRadioButton>
          </ElRadioGroup>
        </div>
        <ElFormItem v-if="context === 'scheme'" label="注意事项" class="precautions-field">
          <ElInput
            v-model="drug.precautions"
            :disabled="readonly || disabled"
            maxlength="1000"
            :aria-label="`药品${index + 1}注意事项`"
            @input="changeDrug(drug)"
          />
        </ElFormItem>
      </div>
    </section>
    <p v-if="cards.length" class="quantity-note"
      >药品量与取药周期是方案默认值，实际余药仍按患者发药登记与实际用量核对。{{
        advanceDays ? `预计余药不足前 ${advanceDays} 天提醒取药。` : ''
      }}</p
    >
  </div>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, toRaw, watch } from 'vue'
  import { ElMessage, ElMessageBox, type UploadFile } from 'element-plus'
  import { Picture, Search, Upload } from '@element-plus/icons-vue'
  import { fetchCommonMedicineList, type CommonMedicineRecord } from '@/api/common-medicine'
  import { uploadImage } from '@/api/auth'
  import request from '@/utils/http'
  import type { Drug, Medication, Source } from '@/api/project'
  type Card = Drug & {
    daily_count: number
    reminders: { time: string; timing: string }[]
    confirmed: boolean
    quantity: number
  }
  const props = defineProps<{
    modelValue: Medication | null
    sources: Source[]
    groupName: string
    readonly: boolean
    disabled: boolean
    advanceDays: number
    context: 'group' | 'scheme'
  }>()
  const emit = defineEmits<{ 'update:modelValue': [value: Medication | null] }>()
  const cards = ref<Card[]>([]),
    treatmentDays = ref(180),
    templateId = ref(0)
  const addMethod = ref(props.context === 'scheme' ? 'prescription' : 'search'),
    keyword = ref(''),
    results = ref<CommonMedicineRecord[]>([])
  const searching = ref(false),
    searched = ref(false),
    searchPage = ref(1),
    resultTotal = ref(0)
  const selectedFile = ref<File>(),
    previewUrl = ref(''),
    prescriptionUrl = ref(''),
    recognizing = ref(false)
  const timings = ['餐后', '餐前', '睡前', '空腹']
  const defaults: Record<number, string[]> = {
    1: ['07:00'],
    2: ['07:00', '19:00'],
    3: ['07:00', '12:00', '19:00'],
    4: ['07:00', '12:00', '18:00', '21:00']
  }
  let emitted: Medication | null = null
  function toCard(drug: Drug, quantity?: number): Card {
    const times = drug.times
      .split(/[,，]/)
      .map((time) => time.trim())
      .filter(Boolean)
    const count = drug.daily_count || times.length || 1
    return {
      ...JSON.parse(JSON.stringify(drug)),
      quantity: quantity ?? drug.quantity ?? 30,
      daily_count: count,
      confirmed: drug.confirmed ?? true,
      reminders:
        drug.reminders?.map((r) => ({ ...r })) || times.map((time) => ({ time, timing: '餐后' }))
    }
  }
  watch(
    () => props.modelValue,
    (value) => {
      if (toRaw(value) === emitted && value !== null) return
      templateId.value = value?.id || 0
      treatmentDays.value = value?.treatment_days || 180
      prescriptionUrl.value = value?.prescription_url || ''
      cards.value = (value?.snapshot.drugs || []).map((d) =>
        toCard(d, value?.quantities.find((q) => q.drug_id === d.drug_id)?.quantity)
      )
    },
    { immediate: true }
  )
  const supplyDays = (drug: Card) =>
    Number(drug.quantity || 0) / (Number(drug.dose) * drug.daily_count)
  const pickupDays = computed(() =>
    Math.min(
      treatmentDays.value || 180,
      Math.max(1, Math.floor(Math.min(...cards.value.map((d) => supplyDays(d) || 1))))
    )
  )
  const confirmedCount = computed(() => cards.value.filter((d) => d.confirmed).length)
  const supplyText = (drug: Card) => {
    const days = supplyDays(drug)
    return !Number.isFinite(days) || days <= 0
      ? '待完善用量'
      : days < 1
        ? '不足 1 天'
        : `约 ${Math.floor(days)} 天`
  }
  function sync() {
    const drugs = cards.value.map((d) => ({
      ...d,
      precautions: props.context === 'group' ? '' : d.precautions,
      reminders: d.reminders.map((r) => ({ ...r })),
      frequency: `每日${d.daily_count}次`,
      times: d.reminders.map((r) => r.time).join(',')
    }))
    const source = props.sources.find((s) => s.id === templateId.value)
    emitted = {
      id: templateId.value,
      snapshot: {
        ...(props.modelValue?.snapshot || source || { id: 0, status: 1 }),
        name: source?.name || `${props.groupName}用药方案`,
        drugs
      },
      drugs,
      treatment_days: treatmentDays.value,
      pickup_mode: 'quantity',
      pickup_days: pickupDays.value,
      advance_days: props.advanceDays,
      prescription_url: prescriptionUrl.value,
      quantities: drugs.map((d) => ({ drug_id: d.drug_id, quantity: d.quantity }))
    }
    emit('update:modelValue', emitted)
  }
  watch(
    () => props.advanceDays,
    () => {
      if (cards.value.length) sync()
    }
  )
  function changeDrug(drug: Card) {
    drug.confirmed = false
    sync()
  }
  function changeFrequency(drug: Card) {
    const expected = defaults[drug.daily_count]
    drug.reminders = expected.map((time, index) => ({
      time,
      timing: drug.reminders[index]?.timing || '餐后'
    }))
    changeDrug(drug)
  }
  function errorFor(drug: Card) {
    if (!drug.name.trim() || drug.name.trim().length > 100) return '请填写有效的药品名称'
    if (!drug.specification.trim() || drug.specification.trim().length > 100)
      return '请填写有效的药品规格'
    if (!/^\d+(\.\d{1,3})?$/.test(String(drug.dose)) || Number(drug.dose) <= 0)
      return '请填写大于0的每次剂量，最多3位小数'
    if (!drug.unit.trim()) return '请填写剂量单位'
    if (!Number.isInteger(drug.quantity) || drug.quantity <= 0) return '请填写有效药品量'
    if (drug.daily_count < 1 || drug.daily_count > 4 || drug.reminders.length !== drug.daily_count)
      return '请选择每日1至4次'
    if (
      drug.reminders.some(
        (r) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) || !timings.includes(r.timing)
      )
    )
      return '请完善每次提醒时间和服药时机'
    if (new Set(drug.reminders.map((r) => r.time)).size !== drug.daily_count)
      return '同一药品的提醒时间不能重复'
    return ''
  }
  function confirm(drug: Card, index: number) {
    const error = errorFor(drug)
    if (error) return ElMessage.warning(`药品${index + 1}：${error}`)
    drug.confirmed = true
    sync()
  }
  async function remove(index: number) {
    try {
      await ElMessageBox.confirm('删除此药品卡片？保存方案后生效。', '删除药品', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
    } catch {
      return
    }
    cards.value.splice(index, 1)
    sync()
  }
  async function useTemplate(id: number) {
    if (cards.value.length) {
      try {
        await ElMessageBox.confirm('带入方案将替换当前药品卡片，是否继续？', '带入通用方案', {
          confirmButtonText: '替换',
          cancelButtonText: '取消'
        })
      } catch {
        return
      }
    }
    const source = props.sources.find((s) => s.id === id)
    if (!source?.drugs) return
    templateId.value = id
    treatmentDays.value = source.treatment_days || 180
    cards.value = source.drugs.map((d) => toCard({ ...d, confirmed: false }))
    prescriptionUrl.value = ''
    sync()
  }
  async function runSearch() {
    searching.value = true
    try {
      const data = await fetchCommonMedicineList({
        current: searchPage.value,
        size: 8,
        keyword: keyword.value.trim(),
        status: 1
      })
      results.value = data.list
      resultTotal.value = data.total
      searched.value = true
    } finally {
      searching.value = false
    }
  }
  function search() {
    searchPage.value = 1
    void runSearch()
  }
  function addMedicine(medicine: CommonMedicineRecord) {
    if (cards.value.length >= 50) return ElMessage.warning('最多添加50种药品')
    if (cards.value.some((d) => d.drug_id === medicine.id)) return
    cards.value.push(
      toCard({
        drug_id: medicine.id,
        name: medicine.common_name,
        specification: medicine.specification,
        dose: '1',
        unit: medicine.dosage_unit || '片',
        frequency: '每日1次',
        times: '07:00',
        precautions: '',
        confirmed: false
      })
    )
    sync()
    ElMessage.success('已添加，请核对并确认药品')
  }
  function selectImage(file: UploadFile) {
    if (!file.raw) return
    if (
      !['image/png', 'image/jpeg', 'image/gif'].includes(file.raw.type) ||
      file.raw.size > 10 * 1024 * 1024
    )
      return ElMessage.warning('请选择10 MB以内的JPG、PNG或GIF图片')
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    selectedFile.value = file.raw
    previewUrl.value = URL.createObjectURL(file.raw)
  }
  async function recognize() {
    if (!selectedFile.value || recognizing.value) return
    recognizing.value = true
    try {
      const form = new FormData()
      form.append('file', selectedFile.value)
      const uploaded = await uploadImage(form)
      const data = await request.post<{ drugs: Drug[]; message: string }>({
        url: '/app/core/medication-scheme/recognize-prescription',
        params: { url: uploaded.url }
      })
      const additions = data.drugs.filter(
        (d) => !cards.value.some((card) => card.drug_id === d.drug_id)
      )
      if (cards.value.length + additions.length > 50)
        return ElMessage.warning('识别后药品超过50种，请先删除多余卡片')
      cards.value.push(...additions.map((d) => toCard(d)))
      prescriptionUrl.value = uploaded.url
      sync()
      ElMessage.info(additions.length ? data.message : '识别药品已在列表中，未重复添加')
    } finally {
      recognizing.value = false
    }
  }
  function validate() {
    if (recognizing.value) {
      ElMessage.warning('请等待处方识别完成')
      return false
    }
    if (cards.value.length && cards.value.some((d) => !d.confirmed || errorFor(d))) {
      ElMessage.warning('请核对并确认全部药品后再保存')
      return false
    }
    sync()
    if (!cards.value.length) emit('update:modelValue', null)
    return true
  }
  defineExpose({ validate })
  onBeforeUnmount(() => {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  })
</script>

<style scoped>
  .medication-editor {
    color: var(--el-text-color-primary);
  }

  h3,
  p {
    margin: 0;
  }

  h3 {
    font-size: 18px;
    font-weight: 600;
  }

  .course-panel,
  .add-panel,
  .drug-card {
    margin-bottom: 22px;
    overflow: hidden;
    border: 1px solid var(--el-border-color);
    border-radius: 6px;
  }

  .course-panel,
  .add-panel {
    padding: 22px;
  }

  .course-title p,
  .quantity-note {
    margin-top: 10px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-secondary);
  }

  .course-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-top: 22px;
  }

  .unit-suffix {
    margin-left: 8px;
    color: var(--el-text-color-regular);
  }

  .calculated-cycle span,
  .calculated-cycle small {
    display: block;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .calculated-cycle strong {
    display: inline-block;
    margin: 8px 0;
    font-size: 24px;
    color: var(--el-color-primary);
  }

  .template-select {
    margin-bottom: 0;
  }

  .template-select :deep(.el-select) {
    width: 100%;
  }

  .add-tabs {
    margin-top: 18px;
  }

  .prescription-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14px 12px 0;
    text-align: center;
  }

  .upload-icon {
    margin: 6px 0 20px;
    color: var(--el-text-color-regular);
  }

  .upload-title {
    margin-bottom: 12px;
    font-size: 18px;
    overflow-wrap: anywhere;
  }

  .upload-description {
    margin-bottom: 24px;
    line-height: 1.7;
    color: var(--el-text-color-secondary);
  }

  .select-image,
  .recognize-button {
    width: 220px;
    height: 42px;
    font-size: 16px;
  }

  .select-image {
    background: var(--el-fill-color-light);
    border-color: transparent;
  }

  .recognize-button {
    margin: 10px 0 0;
  }

  .mock-note {
    margin-top: 16px;
    line-height: 1.6;
    color: var(--el-text-color-secondary);
  }

  .prescription-preview {
    width: 150px;
    height: 100px;
    margin-bottom: 12px;
    object-fit: contain;
  }

  .search-toolbar {
    display: flex;
    gap: 12px;
    margin: 12px 0;
  }

  .search-results {
    min-height: 100px;
  }

  .empty-tip {
    padding: 30px 0;
    color: var(--el-text-color-secondary);
    text-align: center;
  }

  .search-result {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    padding: 14px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .search-result p {
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .cards-summary {
    display: flex;
    justify-content: space-between;
    margin: 20px 0 12px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .drug-card-heading {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    padding: 16px 22px;
    background: var(--el-fill-color-lighter);
    border-bottom: 1px solid var(--el-border-color);
  }

  .drug-card-title,
  .drug-card-heading-tools,
  .drug-card-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .drug-card-heading-tools {
    margin-left: auto;
  }

  .drug-card-heading .el-button + .el-button {
    margin-left: 0;
  }

  .card-supply {
    display: flex;
    gap: 12px;
    align-items: baseline;
    margin-left: 10px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  .card-supply strong {
    font-size: 18px;
    color: var(--el-color-primary);
  }

  .drug-card-body {
    padding: 24px 22px;
  }

  .drug-identity {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 20px;
  }

  .quantity-input {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 72px;
    gap: 8px;
    width: 100%;
  }

  .quantity-input :deep(.el-input-number) {
    width: 100%;
  }

  .dose-line {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
    align-items: center;
    max-width: calc(50% - 10px);
    margin-top: 14px;
  }

  .frequency-field {
    margin-top: 16px;
  }

  .segmented {
    display: flex;
    flex-wrap: nowrap;
    width: 100%;
    padding: 4px;
    background: var(--el-fill-color-light);
    border-radius: 5px;
  }

  .segmented :deep(.el-radio-button) {
    flex: 1;
    min-width: 0;
  }

  .segmented :deep(.el-radio-button__inner) {
    display: block;
    padding: 10px 4px;
    font-size: 15px;
    color: var(--el-text-color-regular);
    background: transparent;
    border: 0 !important;
    border-radius: 4px !important;
    box-shadow: none !important;
  }

  .segmented :deep(.is-active .el-radio-button__inner) {
    color: var(--el-color-primary) !important;
    background: var(--el-bg-color) !important;
  }

  .segmented :deep(.el-radio-button__original-radio:focus-visible + .el-radio-button__inner) {
    outline: 2px solid var(--el-color-primary);
  }

  .reminder-heading {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    margin: 28px 0 18px;
    color: var(--el-text-color-regular);
  }

  .reminder-heading small {
    color: var(--el-text-color-secondary);
  }

  .reminder-row {
    display: grid;
    grid-template-columns: 0.8fr 1fr 2fr;
    gap: 20px;
    align-items: center;
    margin-top: 12px;
  }

  .reminder-row > strong {
    color: var(--el-text-color-regular);
  }

  .precautions-field {
    margin-top: 24px;
    margin-bottom: 0;
  }

  .reminder-row :deep(.el-date-editor) {
    width: 100%;
  }

  .drug-card :deep(.el-input__wrapper) {
    min-height: 38px;
    background: var(--el-fill-color-light);
    box-shadow: none;
  }

  .drug-card :deep(.el-input__wrapper.is-focus) {
    box-shadow: 0 0 0 1px var(--el-color-primary) inset;
  }

  .drug-card :deep(.el-input.is-disabled .el-input__inner) {
    -webkit-text-fill-color: var(--el-text-color-regular);
  }

  .drug-card :deep(.el-input-group__append) {
    box-shadow: none;
  }

  .drug-card :deep(.el-form-item__label) {
    margin-bottom: 12px;
    font-size: 15px;
  }

  @media (width <= 900px) {
    .drug-identity {
      grid-template-columns: 1fr 1fr;
    }

    .drug-identity > :first-child {
      grid-column: 1 / -1;
    }

    .reminder-row {
      grid-template-columns: 0.5fr 1fr;
    }

    .timing {
      grid-column: 1 / -1;
    }

    .dose-line {
      max-width: none;
    }
  }

  @media (width <= 600px) {
    .course-panel,
    .add-panel,
    .drug-card-body {
      padding: 16px;
    }

    .drug-card-heading {
      flex-wrap: wrap;
      padding: 14px;
    }

    .drug-card-heading-tools {
      flex-wrap: wrap;
      justify-content: space-between;
      width: 100%;
    }

    .card-supply {
      margin-left: auto;
    }

    .course-fields,
    .dose-line {
      grid-template-columns: 1fr 1fr;
    }

    .reminder-heading {
      flex-direction: column;
    }

    .search-toolbar {
      flex-direction: column;
    }
  }
</style>
