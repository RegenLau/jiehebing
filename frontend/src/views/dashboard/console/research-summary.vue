<template>
  <ElCard shadow="never" class="summary"
    ><h3>研究管理概览</h3
    ><div v-loading="loading" class="cards"
      ><ElButton v-for="c in cards" :key="c.label" @click="open(c.path)"
        >{{ c.label }}：{{ data[c.key] || 0 }} {{ c.unit }}</ElButton
      ></div
    ></ElCard
  >
</template>
<script setup lang="ts">
  import { ref, onMounted, onActivated, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import request from '@/utils/http'
  const props = defineProps<{ projectId?: number; groupId?: number }>()
  const router = useRouter(),
    data = ref<Record<string, number>>({}),
    loading = ref(false)
  const cards = [
    { label: '治疗中患者', key: 'treating', unit: '人', path: '/patient/index?study_state=治疗中' },
    {
      label: '已完成患者',
      key: 'completed',
      unit: '人',
      path: '/patient/index?study_state=已完成'
    },
    {
      label: '提前退出患者',
      key: 'withdrawn',
      unit: '人',
      path: '/patient/index?study_state=提前退出'
    },
    {
      label: '待核对报告',
      key: 'reports_pending',
      unit: '份',
      path: '/reports/index?status=待核对'
    },
    {
      label: '待跟进事件',
      key: 'events_pending',
      unit: '条',
      path: '/adverse-reaction/index?pending=1'
    },
    { label: '逾期随访任务', key: 'tasks_overdue', unit: '条', path: '/followup/index?overdue=1' }
  ]
  async function load() {
    loading.value = true
    try {
      data.value = await request.get({
        url: '/app/core/dashboard/research',
        params: { project_id: props.projectId, group_id: props.groupId }
      })
    } finally {
      loading.value = false
    }
  }
  function open(path: string) {
    const separator = path.includes('?') ? '&' : '?'
    const scope = [
      props.projectId ? `project_id=${props.projectId}` : '',
      props.groupId ? `group_id=${props.groupId}` : ''
    ]
      .filter(Boolean)
      .join('&')
    void router.push(scope ? `${path}${separator}${scope}` : path)
  }
  watch(() => [props.projectId, props.groupId], load)
  onMounted(load)
  onActivated(load)
</script>
<style scoped>
  .summary {
    margin-bottom: 20px;
  }
  .summary h3 {
    margin-bottom: 16px;
  }
  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .cards .el-button {
    margin: 0;
  }
</style>
