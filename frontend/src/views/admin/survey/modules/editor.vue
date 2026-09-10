<template>
  <ElDialog
    v-model="visible"
    title="编辑问卷"
    width="min(960px,95vw)"
    :close-on-click-modal="false"
    :close-on-press-escape="!saving && !opening"
    :show-close="!saving && !opening"
    :before-close="close"
  >
    <div v-loading="opening">
      <SurveyForm
        ref="surveyForm"
        @saved="handleSaved"
        @cancel="visible = false"
        @saving-change="saving = $event"
      />
    </div>
  </ElDialog>
</template>

<script setup lang="ts">
  import { nextTick, ref } from 'vue'
  import SurveyForm from './survey-form.vue'

  const emit = defineEmits<{ saved: [] }>()
  const visible = ref(false)
  const saving = ref(false)
  const opening = ref(false)
  const surveyForm = ref<InstanceType<typeof SurveyForm>>()

  async function open(id: number) {
    visible.value = true
    opening.value = true
    await nextTick()
    try {
      await surveyForm.value?.open(id)
    } catch {
      visible.value = false
    } finally {
      opening.value = false
    }
  }

  function handleSaved() {
    visible.value = false
    emit('saved')
  }

  function close(done: () => void) {
    if (!saving.value && !opening.value) done()
  }

  defineExpose({ open })
</script>
