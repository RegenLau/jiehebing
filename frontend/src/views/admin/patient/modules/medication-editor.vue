<template>
  <div class="medication-editor">
    <section class="treatment-meta-panel">
      <ElForm label-position="top" :disabled="disabled" class="treatment-meta">
        <div class="form-grid">
          <ElFormItem label="本次方案生效日期" required>
            <ElDatePicker
              :model-value="treatment.start_date"
              value-format="YYYY-MM-DD"
              @update:model-value="updateTreatment({ start_date: $event })"
            />
          </ElFormItem>
          <ElFormItem :label="hasExistingTreatment ? '当前疗程总天数' : '治疗天数'" required>
            <ElInputNumber
              :model-value="treatment.treatment_days"
              :min="1"
              :max="3650"
              :disabled="hasExistingTreatment || !adjusted"
              @update:model-value="updateTreatment({ treatment_days: $event || 1 })"
            />
          </ElFormItem>
          <ElFormItem v-if="hasExistingTreatment" label="疗程结束日期" required>
            <ElDatePicker
              :model-value="treatment.course_end_date || treatment.end_date"
              value-format="YYYY-MM-DD"
              :disabled="!treatment.adjust_course_end"
              @update:model-value="updateTreatment({ course_end_date: $event })"
            />
          </ElFormItem>
          <ElFormItem v-if="hasExistingTreatment" label="调整疗程结束日">
            <div class="course-end-control">
              <ElSwitch
                :model-value="Boolean(treatment.adjust_course_end)"
                :disabled="disabled"
                @update:model-value="updateTreatment({ adjust_course_end: Boolean($event) })"
              />
              <span>{{ treatment.adjust_course_end ? '将按新的结束日期保存' : '保持原疗程结束日期' }}</span>
            </div>
          </ElFormItem>
        </div>
      </ElForm>
    </section>

    <div class="adjustment-row">
      <div><strong>个体调整</strong><p>关闭时完整采用分组方案；打开后只修改当前患者。</p></div>
      <ElSwitch :model-value="adjusted" :disabled="disabled" @update:model-value="changeAdjusted" />
    </div>

    <div v-if="treatment.drugs.length" class="cards-summary">
      <span>已带入 {{ treatment.drugs.length }} 种分组药品</span>
      <span>{{ activeCount }} / {{ treatment.drugs.length }} 本次使用</span>
    </div>
    <ElForm
      v-if="treatment.drugs.length"
      label-position="top"
      :disabled="disabled"
      class="drug-cards"
    >
      <section
        v-for="(drug, index) in treatment.drugs"
        :key="drug.drug_id"
        class="drug-card"
        :class="{ 'is-inactive': !drug.enabled }"
      >
        <header class="drug-card-heading">
          <div class="drug-card-title">
            <h3>药品 {{ index + 1 }}</h3>
            <ElTag :type="drug.enabled ? 'success' : 'info'" effect="light">
              {{ drug.enabled ? '本次使用' : '本次停用' }}
            </ElTag>
          </div>
          <div class="drug-card-heading-tools">
            <ElButton
              v-if="adjusted"
              :type="drug.enabled ? 'warning' : 'primary'"
              plain
              :disabled="disabled"
              @click="updateDrug(index, 'enabled', !drug.enabled)"
            >
              {{ drug.enabled ? '本次停用' : '恢复使用' }}
            </ElButton>
          </div>
        </header>
        <div class="drug-card-body">
          <div class="drug-identity">
            <ElFormItem label="药品名称">
              <ElInput :model-value="drug.name" readonly :aria-label="`药品${index + 1}名称`" />
            </ElFormItem>
            <ElFormItem label="规格">
              <ElInput
                :model-value="drug.specification"
                readonly
                :aria-label="`药品${index + 1}规格`"
              />
            </ElFormItem>
          </div>

          <div class="dose-line">
            <ElFormItem label="每次剂量">
              <ElInput
                :model-value="String(drug.dose)"
                inputmode="decimal"
                :disabled="!adjusted || !drug.enabled || disabled"
                :aria-label="`药品${index + 1}每次剂量`"
                @update:model-value="updateDrug(index, 'dose', $event)"
              />
            </ElFormItem>
            <ElFormItem label="剂量单位">
              <ElInput :model-value="drug.unit" disabled :aria-label="`药品${index + 1}剂量单位`">
                <template #append>/次</template>
              </ElInput>
            </ElFormItem>
          </div>

          <ElFormItem label="每日次数" class="frequency-field">
            <ElRadioGroup
              :model-value="timeCount(drug.times)"
              class="segmented"
              :disabled="!adjusted || !drug.enabled || disabled"
              :aria-label="`药品${index + 1}每日次数`"
              @change="updateDailyCount(index, Number($event))"
            >
              <ElRadioButton v-for="count in [1, 2, 3, 4]" :key="count" :value="count">
                每日{{ count }}次
              </ElRadioButton>
            </ElRadioGroup>
          </ElFormItem>

          <div class="reminder-heading">
            <span>每次提醒时间</span>
            <small>个体调整可修改时间，服药时机沿用分组方案</small>
          </div>
          <div v-for="(time, slot) in drugTimes(drug)" :key="slot" class="reminder-row">
            <strong>第 {{ slot + 1 }} 次</strong>
            <ElTimePicker
              :model-value="time"
              format="HH:mm"
              value-format="HH:mm"
              :clearable="false"
              :disabled="!adjusted || !drug.enabled || disabled"
              :aria-label="`药品${index + 1}第${slot + 1}次提醒时间`"
              @update:model-value="updateReminderTime(index, slot, $event)"
            />
            <ElRadioGroup
              :model-value="reminderTiming(drug, slot)"
              class="segmented timing"
              disabled
              :aria-label="`药品${index + 1}第${slot + 1}次服药时机`"
            >
              <ElRadioButton v-for="timing in timings" :key="timing" :value="timing">
                {{ timing }}
              </ElRadioButton>
            </ElRadioGroup>
          </div>

          <ElFormItem v-if="drug.precautions" label="注意事项" class="precautions-field">
            <ElInput
              :model-value="drug.precautions"
              disabled
              :aria-label="`药品${index + 1}注意事项`"
            />
          </ElFormItem>
        </div>
      </section>
    </ElForm>
    <div v-else class="empty-medication">所选分组尚未配置用药方案</div>

    <ElForm label-position="top" :disabled="disabled" class="reason-form">
      <ElFormItem :label="adjusted ? '个体调整原因' : '方案确认说明'" required>
        <ElInput
          :model-value="treatment.reason"
          maxlength="500"
          :placeholder="adjusted ? '请说明调整依据，仅影响当前患者' : '例如：首次确认采用分组方案'"
          @update:model-value="updateTreatment({ reason: $event })"
        />
      </ElFormItem>
    </ElForm>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type { Drug, GroupRecord } from '@/api/project'

  interface TreatmentDrug extends Omit<Drug, 'dose' | 'times'> {
    dose: string | number
    times: string
    enabled: boolean
  }
  interface Treatment {
    id?: number
    start_date: string
    end_date?: string
    course_start_date?: string
    course_end_date?: string
    treatment_days: number
    adjust_course_end?: boolean
    reason: string
    adjusted?: boolean
    adjustment_summary?: string[]
    drugs: TreatmentDrug[]
    created_at?: string
  }

  const props = defineProps<{
    treatment: Treatment
    adjusted: boolean
    group: GroupRecord | null
    disabled: boolean
    hasExistingTreatment: boolean
  }>()
  const emit = defineEmits<{
    'update:treatment': [value: Treatment]
    'update:adjusted': [value: boolean]
    reset: []
  }>()

  const timings = ['餐后', '餐前', '睡前', '空腹']
  const defaultTimes: Record<number, string[]> = {
    1: ['07:00'],
    2: ['07:00', '19:00'],
    3: ['07:00', '12:00', '19:00'],
    4: ['07:00', '12:00', '18:00', '21:00']
  }
  const activeCount = computed(() => props.treatment.drugs.filter((drug) => drug.enabled).length)

  const updateTreatment = (patch: Partial<Treatment>) =>
    emit('update:treatment', { ...props.treatment, ...patch })
  const updateDrug = (index: number, field: keyof TreatmentDrug, value: unknown) => {
    const drugs = props.treatment.drugs.map((drug, current) =>
      current === index ? { ...drug, [field]: value } : drug
    )
    updateTreatment({ drugs })
  }
  const updateDrugPatch = (index: number, patch: Partial<TreatmentDrug>) => {
    const drugs = props.treatment.drugs.map((drug, current) =>
      current === index ? { ...drug, ...patch } : drug
    )
    updateTreatment({ drugs })
  }
  const changeAdjusted = (value: string | number | boolean) => {
    const adjusted = Boolean(value)
    emit('update:adjusted', adjusted)
    if (!adjusted) emit('reset')
  }
  const drugTimes = (drug: TreatmentDrug) =>
    String(drug.times || '')
      .split(/[，,]/)
      .map((time) => time.trim())
      .filter(Boolean)
  const timeCount = (value: string) =>
    value
      .split(/[，,]/)
      .map((time) => time.trim())
      .filter(Boolean).length
  const reminderTiming = (drug: TreatmentDrug, slot: number) => {
    const source = props.group?.medication?.snapshot.drugs?.find(
      (item) => item.drug_id === drug.drug_id
    )
    return drug.reminders?.[slot]?.timing || source?.reminders?.[slot]?.timing || '餐后'
  }
  const updateDailyCount = (index: number, count: number) => {
    const drug = props.treatment.drugs[index]
    const times = defaultTimes[count]
    if (!drug || !times) return
    const reminders = times.map((time, slot) => ({
      time,
      timing: reminderTiming(drug, slot)
    }))
    updateDrugPatch(index, {
      times: times.join(','),
      reminders,
      frequency: `每日${count}次`
    })
  }
  const updateReminderTime = (index: number, slot: number, value: string | null) => {
    const drug = props.treatment.drugs[index]
    if (!drug || !value) return
    const times = drugTimes(drug)
    times[slot] = value
    updateDrugPatch(index, {
      times: times.join(','),
      reminders: times.map((time, current) => ({
        time,
        timing: reminderTiming(drug, current)
      }))
    })
  }
</script>

<style scoped>
  .medication-editor {
    color: var(--el-text-color-primary);
  }

  h3,
  p {
    margin: 0;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 20px;
  }

  .treatment-meta {
    width: 100%;
  }

  .course-end-control {
    display: flex;
    align-items: center;
    min-height: 32px;
    gap: 10px;
    color: var(--el-text-color-regular);
  }

  .treatment-meta-panel {
    width: 100%;
    box-sizing: border-box;
    padding: 16px 16px 2px;
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    background: var(--el-fill-color-lighter);
    margin-bottom: 20px;
  }

  .adjustment-row {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    margin: 4px 0 16px;
    background: var(--el-fill-color-lighter);
    border-radius: 8px;
  }

  .adjustment-row p {
    margin: 4px 0 0;
    color: var(--el-text-color-secondary);
  }

  .cards-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 20px 0 12px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .drug-card {
    margin-bottom: 22px;
    overflow: hidden;
    border: 1px solid var(--el-border-color);
    border-radius: 6px;
  }

  .drug-card.is-inactive .drug-card-body {
    opacity: 0.66;
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
  .drug-card-heading-tools {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .drug-card-heading-tools {
    margin-left: auto;
  }

  .drug-card-heading h3 {
    font-size: 18px;
    font-weight: 600;
  }

  .drug-card-body {
    padding: 24px 22px;
  }

  .drug-identity {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
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

  .reminder-row :deep(.el-date-editor) {
    width: 100%;
  }

  .precautions-field {
    margin-top: 24px;
    margin-bottom: 0;
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

  .empty-medication {
    padding: 36px;
    color: var(--el-text-color-secondary);
    text-align: center;
    background: var(--el-fill-color-lighter);
  }

  .reason-form {
    margin-top: 20px;
  }

  :deep(.el-date-editor.el-input) {
    width: 100%;
  }

  @media (width <= 900px) {
    .drug-identity {
      grid-template-columns: 1fr 1fr;
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

  @media (width <= 700px) {
    .form-grid {
      grid-template-columns: 1fr;
    }

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

    .dose-line {
      grid-template-columns: 1fr 1fr;
    }

    .drug-identity {
      grid-template-columns: 1fr;
    }

    .reminder-heading {
      flex-direction: column;
    }
  }
</style>
