<template>
  <div class="survey-form">
    <ElForm label-position="top" :disabled="saving">
      <ElFormItem label="问卷名称">
        <ElInput v-model="form.name" maxlength="128" />
      </ElFormItem>
      <ElFormItem label="模板编码">
        <ElInput v-model="form.code" maxlength="64" />
      </ElFormItem>
      <ElFormItem label="问卷说明">
        <ElInput v-model="form.description" maxlength="256" />
      </ElFormItem>
      <p class="tip">填写时间由分组安排。已有作答的题型及选项删除受保护，旧答卷保留原文。</p>

      <div
        v-for="(questionItem, questionIndex) in form.questions"
        :key="questionIndex"
        class="question"
      >
        <div class="toolbar">
          <strong>第 {{ questionIndex + 1 }} 题</strong>
          <ElButton link type="danger" @click="form.questions.splice(questionIndex, 1)">
            删除题目
          </ElButton>
        </div>
        <ElFormItem label="题干">
          <ElInput v-model="questionItem.title" maxlength="512" />
        </ElFormItem>
        <div class="toolbar question-setting">
          <ElSelect v-model="questionItem.type">
            <ElOption label="单选" value="RADIO" />
            <ElOption label="多选" value="CHECKBOX" />
            <ElOption label="文本" value="TEXT" />
          </ElSelect>
          <ElCheckbox v-model="questionItem.required" :true-value="1" :false-value="0">
            必填
          </ElCheckbox>
        </div>

        <template v-if="questionItem.type !== 'TEXT'">
          <div
            v-for="(optionItem, optionIndex) in questionItem.options"
            :key="optionIndex"
            class="option"
          >
            <div class="toolbar option-setting">
              <ElInput v-model="optionItem.label" placeholder="选项内容" maxlength="128" />
              <ElCheckbox v-model="optionItem.isExclusive">互斥</ElCheckbox>
              <ElCheckbox v-model="optionItem.triggerInput" @change="condition(optionItem)">
                补充输入
              </ElCheckbox>
              <ElButton link type="danger" @click="questionItem.options.splice(optionIndex, 1)">
                删除
              </ElButton>
            </div>
            <ElInput
              v-if="optionItem.triggerInput && optionItem.inputFields?.length"
              v-model="optionItem.inputFields[0].field_label"
              placeholder="补充问题，如：请说明症状"
            />
          </div>
          <ElButton @click="questionItem.options.push(option())">添加选项</ElButton>
        </template>
        <ElFormItem v-else label="输入提示">
          <ElInput v-model="questionItem.placeholder" maxlength="256" />
        </ElFormItem>
      </div>
      <ElButton @click="form.questions.push(question())">添加题目</ElButton>
    </ElForm>

    <div class="footer">
      <ElButton :disabled="saving" @click="emit('cancel')">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="save">保存问卷</ElButton>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import request from '@/utils/http'
  import { fetchSurveyDetail, type SurveyQuestion, type SurveyQuestionOption } from '@/api/survey'

  const emit = defineEmits<{
    saved: []
    cancel: []
    'saving-change': [value: boolean]
  }>()

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

  const saving = ref(false)
  const form = ref(blank())

  async function open(id?: number) {
    form.value = id ? { ...blank(), ...(await fetchSurveyDetail(id)) } : blank()
  }

  function condition(optionItem: SurveyQuestionOption) {
    if (optionItem.triggerInput && !optionItem.inputFields?.length) {
      optionItem.inputFields = [
        {
          field_key: 'detail',
          field_label: '补充说明',
          field_type: 'text',
          required: true,
          placeholder: '请输入说明'
        }
      ]
    }
  }

  async function save() {
    if (!form.value.name.trim() || !form.value.code.trim() || !form.value.questions.length) {
      ElMessage.warning('请填写名称、编码和题目')
      return
    }

    saving.value = true
    emit('saving-change', true)
    let saved = false
    try {
      await request.post({
        url: '/app/core/survey/save',
        params: {
          ...form.value,
          questions: form.value.questions.map((questionItem, questionIndex) => ({
            ...questionItem,
            questionNo: questionIndex + 1,
            sortOrder: questionIndex + 1,
            options: questionItem.options.map((optionItem, optionIndex) => ({
              ...optionItem,
              sortOrder: optionIndex + 1
            }))
          }))
        },
        showSuccessMessage: true
      })
      saved = true
    } finally {
      saving.value = false
      emit('saving-change', false)
    }
    if (saved) emit('saved')
  }

  defineExpose({ open })
</script>

<style scoped>
  .tip {
    color: var(--el-text-color-secondary);
    line-height: 1.6;
  }

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

  .question-setting .el-select {
    width: 160px;
  }

  .option {
    margin: 12px 0;
  }

  .option-setting .el-input {
    flex: 1;
  }

  .footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 20px;
  }

  @media (max-width: 720px) {
    .question {
      padding: 16px;
    }

    .option-setting {
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .option-setting .el-input {
      flex-basis: 100%;
    }
  }
</style>
