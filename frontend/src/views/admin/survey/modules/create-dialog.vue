<template>
  <ElDialog
    v-model="visible"
    title="新增问卷"
    width="520px"
    :close-on-click-modal="false"
    :close-on-press-escape="!creating"
    :show-close="!creating"
    :before-close="close"
  >
    <ElForm ref="formRef" :model="form" label-position="top" :disabled="creating">
      <ElFormItem
        label="问卷标题"
        prop="name"
        :rules="[{ required: true, message: '请填写问卷标题', trigger: 'blur' }]"
      >
        <ElInput
          v-model.trim="form.name"
          maxlength="128"
          show-word-limit
          placeholder="请输入问卷标题"
          @keyup.enter="submit"
        />
      </ElFormItem>
      <ElFormItem label="问卷说明">
        <ElInput
          v-model.trim="form.description"
          type="textarea"
          :rows="4"
          maxlength="256"
          show-word-limit
          placeholder="请输入问卷用途或填写说明（选填）"
        />
      </ElFormItem>
    </ElForm>

    <ElAlert
      type="info"
      :closable="false"
      show-icon
      title="问卷编号由系统自动生成。创建后，请在列表操作栏点击“编辑”添加题目。"
    />

    <template #footer>
      <ElButton :disabled="creating" @click="visible = false">取消</ElButton>
      <ElButton type="primary" :loading="creating" @click="submit">创建问卷</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { nextTick, reactive, ref } from 'vue'
  import { ElMessage, type FormInstance } from 'element-plus'
  import { createSurvey } from '@/api/survey'

  const emit = defineEmits<{ saved: [] }>()
  const visible = ref(false)
  const creating = ref(false)
  const formRef = ref<FormInstance>()
  const form = reactive({ name: '', description: '' })

  async function open() {
    form.name = ''
    form.description = ''
    visible.value = true
    await nextTick()
    formRef.value?.clearValidate()
  }

  async function submit() {
    if (creating.value || !(await formRef.value?.validate().catch(() => false))) return
    creating.value = true
    try {
      await createSurvey({ ...form })
      visible.value = false
      ElMessage.success('问卷已创建，请点击“编辑”添加题目')
      emit('saved')
    } catch {
      /* 请求层已提示，保留内容供修正 */
    } finally {
      creating.value = false
    }
  }

  function close(done: () => void) {
    if (!creating.value) done()
  }

  defineExpose({ open })
</script>

<style scoped>
  .el-alert {
    margin-top: 4px;
  }
</style>
