<template>
  <ElDialog
    v-model="visible"
    title="不良反应评估与跟进"
    width="900px"
    :close-on-click-modal="false"
    :before-close="close"
    ><template v-if="record"
      ><p>{{ record.patient_name }} · {{ record.occurred_at }}</p
      ><ElAlert
        :title="'原始上报：' + record.symptom_summary + ' · ' + record.severity_text"
        :closable="false" /><p>{{ record.symptom_description }}</p
      ><ElForm label-position="top" :disabled="saving"
        ><div class="grid"
          ><ElFormItem label="处理状态"
            ><ElSelect v-model="form.processing_status"
              ><ElOption
                v-for="s in ['待处理', '处理中', '已处理']"
                :key="s"
                :label="s"
                :value="s" /></ElSelect></ElFormItem
          ><ElFormItem label="负责人员"
            ><ElSelect v-model="form.owner_id"
              ><ElOption
                v-for="a in owners"
                :key="a.id"
                :label="a.realname || a.username"
                :value="a.id"
                :disabled="a.status !== 1" /></ElSelect></ElFormItem
          ><ElFormItem label="事件名称"><ElInput v-model="form.event_name" /></ElFormItem
          ><ElFormItem label="事件分类"
            ><ElSelect v-model="form.category"
              ><ElOption label="一般症状" value="一般症状" /><ElOption
                label="AE"
                value="AE" /></ElSelect></ElFormItem
          ><ElFormItem label="研究者评估严重程度"
            ><ElSelect v-model="form.assessed_severity"
              ><ElOption label="轻度" :value="1" /><ElOption label="中度" :value="2" /><ElOption
                label="重度"
                :value="3" /></ElSelect></ElFormItem
          ><ElFormItem label="结束时间（如有）"
            ><ElDatePicker
              v-model="form.ended_at"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm:ss" /></ElFormItem></div
        ><div class="toolbar"
          ><ElCheckbox v-model="form.serious">符合严重事件条件</ElCheckbox
          ><ElCheckbox v-model="form.special_interest">特别关注事件</ElCheckbox></div
        ><p>严重程度、严重性和特别关注属性分别判断。</p
        ><ElFormItem label="与用药的相关性"><ElInput v-model="form.relatedness" /></ElFormItem
        ><ElFormItem label="采取措施"
          ><ElInput v-model="form.measures" type="textarea" /></ElFormItem
        ><ElFormItem label="结局/处理结果"><ElInput v-model="form.outcome" /></ElFormItem
        ><ElFormItem label="本次评估说明"
          ><ElInput v-model="form.reason" type="textarea" /></ElFormItem
        ><ElButton type="primary" :loading="saving" @click="save">保存评估</ElButton
        ><h3>实际联系记录</h3><p>请登记已执行的联系；此处不会发送外部通知。</p
        ><div class="grid"
          ><ElFormItem label="渠道"
            ><ElInput v-model="contact.channel" placeholder="如电话、院内渠道" /></ElFormItem
          ><ElFormItem label="联系结果"><ElInput v-model="contact.result" /></ElFormItem
          ><ElFormItem label="后续安排"><ElInput v-model="contact.next_action" /></ElFormItem></div
        ><ElButton :loading="saving" @click="saveContact">登记联系</ElButton></ElForm
      ><ElTable :data="record.contacts || []"
        ><ElTableColumn prop="time" label="时间" /><ElTableColumn
          prop="channel"
          label="渠道" /><ElTableColumn prop="result" label="结果" /><ElTableColumn
          prop="next_action"
          label="后续安排" /></ElTable
      ><h3>评估记录</h3
      ><ElTable :data="record.processing_history || []"
        ><ElTableColumn prop="time" label="时间" /><ElTableColumn
          prop="operator"
          label="评估人" /><ElTableColumn prop="reason" label="说明" /></ElTable></template
  ></ElDialog>
</template>
<script setup lang="ts">
  import { ref } from 'vue'
  import request from '@/utils/http'
  interface Form {
    processing_status: string
    owner_id?: number
    event_name: string
    category: string
    assessed_severity: number
    serious: boolean
    special_interest: boolean
    relatedness: string
    measures: string
    outcome: string
    ended_at: string
    reason: string
  }
  interface Record {
    id: number
    patient_name: string
    occurred_at: string
    symptom_summary: string
    severity_text: string
    symptom_description: string
    assessment?: Form
    assessment_revision?: number
    processing_status?: string
    contacts?: { time: string; channel: string; result: string; next_action: string }[]
    processing_history?: { time: string; operator: string; reason: string }[]
  }
  const blank = (): Form => ({
      processing_status: '待处理',
      event_name: '',
      category: '一般症状',
      assessed_severity: 1,
      serious: false,
      special_interest: false,
      relatedness: '',
      measures: '',
      outcome: '',
      ended_at: '',
      reason: ''
    }),
    emit = defineEmits<{ saved: [] }>(),
    visible = ref(false),
    saving = ref(false),
    record = ref<Record>(),
    form = ref(blank()),
    owners = ref<{ id: number; realname: string; username: string; status: number }[]>([]),
    contact = ref({ channel: '', result: '', next_action: '' })
  async function open(id: number) {
    record.value = await request.get({
      url: '/app/core/adverse-reaction/assessment',
      params: { id }
    })
    form.value = {
      ...blank(),
      ...record.value?.assessment,
      processing_status: record.value?.processing_status || '待处理',
      reason: ''
    }
    owners.value = await request.get({ url: '/app/core/admin/index' })
    contact.value = { channel: '', result: '', next_action: '' }
    visible.value = true
  }
  async function save() {
    saving.value = true
    try {
      await request.post({
        url: '/app/core/adverse-reaction/assess',
        params: {
          ...form.value,
          id: record.value?.id,
          revision: record.value?.assessment_revision || 0
        },
        showSuccessMessage: true
      })
      await open(record.value!.id)
      emit('saved')
    } finally {
      saving.value = false
    }
  }
  async function saveContact() {
    saving.value = true
    try {
      await request.post({
        url: '/app/core/adverse-reaction/contact',
        params: { id: record.value?.id, ...contact.value },
        showSuccessMessage: true
      })
      await open(record.value!.id)
      emit('saved')
    } finally {
      saving.value = false
    }
  }
  function close(done: () => void) {
    if (!saving.value) done()
  }
  defineExpose({ open })
</script>
<style scoped>
  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 16px;
  }
  .toolbar {
    display: flex;
    gap: 20px;
    margin: 16px 0;
  }
  .el-select {
    width: 100%;
  }
</style>
