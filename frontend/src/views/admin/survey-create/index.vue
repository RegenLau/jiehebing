<template>
  <div class="survey-create-page">
    <div class="heading">
      <div>
        <ElButton link type="primary" :disabled="saving" @click="backToList">
          返回问卷列表
        </ElButton>
        <h2>新增问卷</h2>
        <p>填写问卷基本信息，并按顺序配置题目与选项。</p>
      </div>
    </div>

    <ElCard shadow="never">
      <SurveyForm @saved="handleSaved" @cancel="backToList" @saving-change="saving = $event" />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { onBeforeRouteLeave, useRouter } from 'vue-router'
  import SurveyForm from '../survey/modules/survey-form.vue'

  defineOptions({ name: 'SurveyCreate' })

  const router = useRouter()
  const saving = ref(false)

  function backToList() {
    if (!saving.value) void router.push('/survey/index')
  }

  async function handleSaved() {
    await router.push('/survey/index')
  }

  onBeforeRouteLeave(() => !saving.value)
</script>

<style scoped>
  .survey-create-page {
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
