<template>
  <ElDialog
    v-model="visible"
    :title="form.id ? '编辑问卷' : '新增问卷'"
    width="min(960px,95vw)"
    :close-on-click-modal="false"
    :before-close="close"
    ><ElForm label-position="top" :disabled="saving"
      ><ElFormItem label="问卷名称"><ElInput v-model="form.name" maxlength="128" /></ElFormItem
      ><ElFormItem label="模板编码"><ElInput v-model="form.code" maxlength="64" /></ElFormItem
      ><ElFormItem label="问卷说明"
        ><ElInput v-model="form.description" maxlength="256" /></ElFormItem
      ><p>填写时间由分组安排。已有作答的题型及选项删除受保护，旧答卷保留原文。</p
      ><div v-for="(q, i) in form.questions" :key="i" class="question"
        ><div class="toolbar"
          ><strong>第 {{ i + 1 }} 题</strong
          ><ElButton link type="danger" @click="form.questions.splice(i, 1)"
            >删除题目</ElButton
          ></div
        ><ElFormItem label="题干"><ElInput v-model="q.title" maxlength="512" /></ElFormItem
        ><div class="toolbar"
          ><ElSelect v-model="q.type"
            ><ElOption label="单选" value="RADIO" /><ElOption
              label="多选"
              value="CHECKBOX" /><ElOption label="文本" value="TEXT" /></ElSelect
          ><ElCheckbox v-model="q.required" :true-value="1" :false-value="0">必填</ElCheckbox></div
        ><template v-if="q.type !== 'TEXT'"
          ><div v-for="(o, j) in q.options" :key="j" class="option"
            ><div class="toolbar"
              ><ElInput v-model="o.label" placeholder="选项内容" maxlength="128" /><ElCheckbox
                v-model="o.isExclusive"
                >互斥</ElCheckbox
              ><ElCheckbox v-model="o.triggerInput" @change="condition(o)">补充输入</ElCheckbox
              ><ElButton link type="danger" @click="q.options.splice(j, 1)">删除</ElButton></div
            ><ElInput
              v-if="o.triggerInput && o.inputFields?.length"
              v-model="o.inputFields[0].field_label"
              placeholder="补充问题，如：请说明症状" /></div
          ><ElButton @click="q.options.push(option())">添加选项</ElButton></template
        ><ElFormItem v-else label="输入提示"
          ><ElInput v-model="q.placeholder" maxlength="256" /></ElFormItem></div
      ><ElButton @click="form.questions.push(question())">添加题目</ElButton></ElForm
    ><template #footer
      ><ElButton :disabled="saving" @click="visible = false">取消</ElButton
      ><ElButton type="primary" :loading="saving" @click="save">保存问卷</ElButton></template
    ></ElDialog
  >
</template>
<script setup lang="ts">
  import { ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import request from '@/utils/http'
  import { fetchSurveyDetail, type SurveyQuestion, type SurveyQuestionOption } from '@/api/survey'
  const emit = defineEmits<{ saved: [] }>()
  const option = (): SurveyQuestionOption => ({
    id: 0,
    label: '',
    sortOrder: 0,
    isExclusive: false,
    triggerInput: false,
    inputFields: null
  })
  const question = (): SurveyQuestion => ({
    id: 0,
    questionNo: 1,
    title: '',
    type: 'RADIO',
    required: 1,
    sortOrder: 0,
    placeholder: '',
    options: [option(), option()]
  })
  const blank = () => ({
    id: undefined as number | undefined,
    name: '',
    code: '',
    description: '',
    fillableDay: 0,
    status: 1,
    version: undefined as number | undefined,
    questions: [question()]
  })
  const visible = ref(false),
    saving = ref(false),
    form = ref(blank())
  async function open(id?: number) {
    form.value = id ? { ...blank(), ...(await fetchSurveyDetail(id)) } : blank()
    visible.value = true
  }
  function condition(o: SurveyQuestionOption) {
    if (o.triggerInput && !o.inputFields?.length)
      o.inputFields = [
        {
          field_key: 'detail',
          field_label: '补充说明',
          field_type: 'text',
          required: true,
          placeholder: '请输入说明'
        }
      ]
  }
  async function save() {
    if (!form.value.name.trim() || !form.value.code.trim() || !form.value.questions.length) {
      ElMessage.warning('请填写名称、编码和题目')
      return
    }
    saving.value = true
    try {
      await request.post({
        url: '/app/core/survey/save',
        params: {
          ...form.value,
          questions: form.value.questions.map((q, i) => ({
            ...q,
            questionNo: i + 1,
            sortOrder: i + 1,
            options: q.options.map((o, j) => ({ ...o, sortOrder: j + 1 }))
          }))
        },
        showSuccessMessage: true
      })
      visible.value = false
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
  .question {
    padding: 20px;
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    margin: 20px 0;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
  }
  .toolbar strong {
    flex: 1;
  }
  .toolbar .el-select {
    width: 160px;
  }
  .option {
    margin: 12px 0;
  }
</style>
