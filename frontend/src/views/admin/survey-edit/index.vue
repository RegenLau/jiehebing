<template>
  <div class="survey-edit-page">
    <div class="heading">
      <div>
        <ElButton link type="primary" :disabled="saving" @click="backToList">
          返回问卷列表
        </ElButton>
        <h2>编辑问卷</h2>
        <p>添加、调整问卷题目与选项。</p>
      </div>
    </div>

    <ElCard shadow="never" v-loading="opening">
      <ElResult v-if="error" icon="warning" title="无法加载问卷" :sub-title="error">
        <template #extra>
          <ElButton @click="load">重试</ElButton>
          <ElButton type="primary" @click="backToList">返回问卷列表</ElButton>
        </template>
      </ElResult>
      <div v-else v-show="loaded">
        <SurveyForm
          ref="surveyForm"
          @saved="handleSaved"
          @cancel="backToList"
          @saving-change="saving = $event"
        />
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { nextTick, ref, watch } from 'vue'
  import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
  import SurveyForm from '../survey/modules/survey-form.vue'

  defineOptions({ name: 'SurveyEdit' })

  const route = useRoute()
  const router = useRouter()
  const surveyForm = ref<InstanceType<typeof SurveyForm>>()
  const opening = ref(false)
  const saving = ref(false)
  const loaded = ref(false)
  const error = ref('')
  let sequence = 0

  async function load() {
    const seq = ++sequence
    const id = Number(route.query.id)
    loaded.value = false
    error.value = ''
    if (!Number.isSafeInteger(id) || id <= 0) {
      error.value = '问卷编号不正确'
      return
    }

    opening.value = true
    await nextTick()
    try {
      const editor = surveyForm.value
      if (!editor) throw new Error('问卷编辑器未就绪')
      await editor.open(id)
      if (seq === sequence) loaded.value = true
    } catch {
      if (seq === sequence) error.value = '问卷不存在或暂时无法加载'
    } finally {
      if (seq === sequence) opening.value = false
    }
  }

  function backToList() {
    if (!saving.value) void router.push('/survey/index')
  }

  async function handleSaved() {
    await router.push('/survey/index')
  }

  onBeforeRouteLeave(() => !saving.value)
  watch(() => route.query.id, load, { immediate: true })
</script>

<style scoped>
  .survey-edit-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .heading h2 {
    margin: 8px 0 6px;
    font-size: 22px;
    font-weight: 700;
  }

  .heading p {
    margin: 0;
    color: var(--el-text-color-secondary);
  }
</style>
