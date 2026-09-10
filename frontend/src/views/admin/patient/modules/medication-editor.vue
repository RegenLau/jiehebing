<template>
  <div class="medication-editor">
    <ElForm label-position="top" :disabled="disabled" class="treatment-meta">
      <div class="form-grid">
        <ElFormItem label="开始用药日期" required>
          <ElDatePicker
            :model-value="treatment.start_date"
            value-format="YYYY-MM-DD"
            @update:model-value="updateTreatment({ start_date: $event })"
          />
        </ElFormItem>
        <ElFormItem label="治疗天数" required>
          <ElInputNumber
            :model-value="treatment.treatment_days"
            :min="1"
            :max="3650"
            :disabled="!adjusted"
            @update:model-value="updateTreatment({ treatment_days: $event || 1 })"
          />
        </ElFormItem>
      </div>
    </ElForm>

    <div class="adjustment-row">
      <div><strong>个体调整</strong><p>关闭时完整采用分组方案；打开后只修改当前患者。</p></div>
      <ElSwitch :model-value="adjusted" :disabled="disabled" @update:model-value="changeAdjusted" />
    </div>

    <ElTable v-if="treatment.drugs.length" :data="treatment.drugs" border class="drug-table">
      <ElTableColumn label="使用" width="76">
        <template #default="{ row, $index }">
          <ElSwitch
            v-if="adjusted"
            :model-value="row.enabled"
            :disabled="disabled"
            @update:model-value="updateDrug($index, 'enabled', $event)"
          />
          <ElTag v-else type="success">使用</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="药品与规格" min-width="180">
        <template #default="{ row }"
          ><strong>{{ row.name }}</strong
          ><p class="cell-note">{{ row.specification }}</p></template
        >
      </ElTableColumn>
      <ElTableColumn label="单次用量" min-width="150">
        <template #default="{ row, $index }">
          <div v-if="adjusted && row.enabled" class="dose-input">
            <ElInputNumber
              :model-value="Number(row.dose)"
              :min="0.001"
              :precision="3"
              :controls="false"
              @update:model-value="updateDrug($index, 'dose', $event || 0)"
            />
            <span>{{ row.unit }}</span>
          </div>
          <span v-else>{{ row.enabled ? `${row.dose}${row.unit}` : '本次停用' }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="服药时间" min-width="180">
        <template #default="{ row, $index }">
          <ElInput
            v-if="adjusted && row.enabled"
            :model-value="row.times"
            placeholder="例如 08:00,20:00"
            @update:model-value="updateDrug($index, 'times', $event)"
          />
          <span v-else>{{ row.enabled ? row.times.replaceAll(',', '、') : '-' }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="频次" width="110">
        <template #default="{ row }">{{
          row.enabled ? `每日 ${timeCount(row.times)} 次` : '-'
        }}</template>
      </ElTableColumn>
    </ElTable>
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
    treatment_days: number
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
  }>()
  const emit = defineEmits<{
    'update:treatment': [value: Treatment]
    'update:adjusted': [value: boolean]
    reset: []
  }>()

  const updateTreatment = (patch: Partial<Treatment>) =>
    emit('update:treatment', { ...props.treatment, ...patch })
  const updateDrug = (index: number, field: keyof TreatmentDrug, value: unknown) => {
    const drugs = props.treatment.drugs.map((drug, current) =>
      current === index ? { ...drug, [field]: value } : drug
    )
    updateTreatment({ drugs })
  }
  const changeAdjusted = (value: string | number | boolean) => {
    const adjusted = Boolean(value)
    emit('update:adjusted', adjusted)
    if (!adjusted) emit('reset')
  }
  const timeCount = (value: string) => value.split(/[，,]/).filter(Boolean).length
</script>

<style scoped>
  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 20px;
  }
  .treatment-meta {
    max-width: 760px;
  }
  .adjustment-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin: 4px 0 16px;
    padding: 14px 16px;
    border-radius: 8px;
    background: var(--el-fill-color-lighter);
  }
  .adjustment-row p,
  .cell-note {
    margin: 4px 0 0;
    color: var(--el-text-color-secondary);
  }
  .drug-table {
    margin-bottom: 16px;
  }
  .cell-note {
    font-size: 12px;
  }
  .dose-input {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dose-input :deep(.el-input-number) {
    width: 104px;
  }
  .empty-medication {
    padding: 36px;
    text-align: center;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-lighter);
  }
  .reason-form {
    margin-top: 20px;
  }
  :deep(.el-date-editor.el-input) {
    width: 100%;
  }
  @media (max-width: 700px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
