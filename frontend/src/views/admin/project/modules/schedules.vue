<template>
  <div>
    <div class="add-row">
      <ElSelect v-model="selected" :placeholder="`选择${label}`" filterable style="width: 340px">
        <ElOption
          v-for="s in sources.filter((s) => s.status === 1 && !model.some((r) => r.id === s.id))"
          :key="s.id"
          :label="s.name || s.title"
          :value="s.id"
        />
      </ElSelect>
      <ElButton @click="add">添加{{ label }}</ElButton>
    </div>
    <ElEmpty v-if="!model.length" :description="`暂未关联${label}`" :image-size="45" />
    <div v-for="(row, index) in model" :key="row.id" class="schedule">
      <div class="row-title"
        ><strong>{{ row.snapshot.name }}</strong
        ><ElTag v-if="sources.find((s) => s.id === row.id)?.status !== 1" type="warning"
          >来源已停用</ElTag
        ><ElButton link type="danger" @click="model.splice(index, 1)">移除</ElButton></div
      >
      <ElCollapse
        ><ElCollapseItem title="查看内容"
          ><p>{{ row.snapshot.description }}</p
          ><p>{{ row.snapshot.requirements }}</p
          ><ol v-if="row.snapshot.questions"
            ><li v-for="q in row.snapshot.questions" :key="q.id"
              >{{ q.title }}<p>{{ q.options.map((o) => o.label).join(' / ') }}</p></li
            ></ol
          ></ElCollapseItem
        ></ElCollapse
      >
      <div class="fields">
        <ElFormItem label="开始计算日期"
          ><ElSelect v-model="row.anchor" @change="resetAnchor(row)"
            ><ElOption label="入组日期" value="enrollment" /><ElOption
              label="开始用药日期"
              value="treatment" /><ElOption label="指定日期" value="date" /></ElSelect
        ></ElFormItem>
        <ElFormItem v-if="row.anchor === 'date'" label="执行日期"
          ><ElDatePicker v-model="row.date" value-format="YYYY-MM-DD"
        /></ElFormItem>
        <ElFormItem v-else label="第一次执行（开始计算日期后第几天）"
          ><ElInputNumber v-model="row.offset_days" :min="0" :max="3650" :precision="0" /><span
            class="unit-suffix"
            >天后执行</span
          ></ElFormItem
        >
        <ElFormItem label="执行频率（每几天执行一次）"
          ><ElInputNumber
            v-model="row.interval_days"
            :min="0"
            :max="3650"
            :precision="0"
            :disabled="row.anchor === 'date'"
          /><span class="unit-suffix">天</span></ElFormItem
        >
        <ElFormItem label="完成期限（天）"
          ><ElInputNumber v-model="row.deadline_days" :min="1" :max="3650" :precision="0"
        /></ElFormItem>
        <ElFormItem label="提醒时间">
          <ElTimePicker
            v-model="row.remind_time"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="选择时间"
          />
        </ElFormItem>
      </div>
      <div class="schedule-help">
        <p>0 天表示开始计算日当天；完成期限包含执行当天。</p>
        <strong>未来三次示例（{{ row.anchor === 'date' ? '按指定日期' : `假设开始计算日为 ${todayText}` }}）</strong>
        <span v-for="item in schedulePreview(row)" :key="item.start">
          {{ item.start }} 开放，{{ item.due }} 截止
        </span>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
  import { ref } from 'vue'
  import type { Schedule, Source } from '@/api/project'
  const props = defineProps<{ sources: Source[]; label: string }>()
  const model = defineModel<Schedule[]>({ required: true })
  const selected = ref<number>()
  const todayText = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
  const shiftDate = (date: string, days: number) => {
    const value = new Date(`${date}T00:00:00Z`)
    value.setUTCDate(value.getUTCDate() + days)
    return value.toISOString().slice(0, 10)
  }
  function schedulePreview(row: Schedule) {
    const base = row.anchor === 'date' ? row.date || todayText : todayText
    const first = shiftDate(base, row.anchor === 'date' ? 0 : Number(row.offset_days || 0))
    const interval = Number(row.interval_days || 0)
    const count = interval > 0 ? 3 : 1
    return Array.from({ length: count }, (_, index) => {
      const start = shiftDate(first, interval * index)
      return { start, due: shiftDate(start, Math.max(1, Number(row.deadline_days || 1)) - 1) }
    })
  }
  function add() {
    const source = props.sources.find((s) => s.id === selected.value)
    if (!source || model.value.some((r) => r.id === source.id)) return
    model.value.push({
      id: source.id,
      snapshot: JSON.parse(JSON.stringify(source)),
      anchor: 'treatment',
      date: '',
      offset_days: 0,
      interval_days: 0,
      deadline_days: 1,
      remind_time: '09:00'
    })
    selected.value = undefined
  }
  function resetAnchor(row: Schedule) {
    row.date = ''
    if (row.anchor === 'date') {
      row.offset_days = 0
      row.interval_days = 0
    }
  }
</script>
<style scoped>
  .add-row,
  .row-title {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
  }
  .row-title strong {
    flex: 1;
  }
  .schedule {
    padding: 16px;
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    margin: 12px 0;
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 20px;
    margin-top: 16px;
  }
  .fields :deep(.el-select),
  .fields :deep(.el-date-editor) {
    width: 100%;
  }

  .unit-suffix {
    margin-left: 8px;
    color: var(--el-text-color-regular);
  }
  .schedule-help {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 6px;
    background: var(--el-fill-color-light);
    color: var(--el-text-color-regular);
    font-size: 12px;
  }
  .schedule-help p {
    margin: 0 0 4px;
    color: var(--el-text-color-secondary);
  }
  @media (max-width: 700px) {
    .fields {
      grid-template-columns: 1fr;
    }
  }
</style>
