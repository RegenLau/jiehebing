<template><ElButton :loading="loading" @click="download">导出 Excel</ElButton></template>
<script setup lang="ts">
  import { ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import request from '@/utils/http'
  const props = defineProps<{ kind: string; params?: Record<string, unknown> }>(),
    loading = ref(false)
  async function download() {
    loading.value = true
    try {
      const blob = await request.request<Blob>({
        url: '/app/core/research/export',
        method: 'GET',
        params: { ...props.params, kind: props.kind },
        responseType: 'blob'
      })
      if (blob.type.includes('json')) {
        const data = JSON.parse(await blob.text())
        ElMessage.error(data.message || '导出失败')
        return
      }
      const url = URL.createObjectURL(blob),
        a = document.createElement('a')
      a.href = url
      a.download = props.kind + '.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      loading.value = false
    }
  }
</script>
