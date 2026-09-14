<template>
  <div class="research-scope-filter">
    <ElSelect
      :model-value="projectId"
      placeholder="全部研究"
      clearable
      filterable
      @change="changeProject"
    >
      <ElOption
        v-for="project in projects"
        :key="project.id"
        :label="project.name"
        :value="project.id"
      />
    </ElSelect>
    <ElSelect
      :model-value="groupId"
      placeholder="全部分组"
      clearable
      filterable
      :disabled="!projectId"
      @change="changeGroup"
    >
      <ElOption v-for="group in groups" :key="group.id" :label="group.name" :value="group.id" />
    </ElSelect>
    <ElDatePicker
      v-if="showDate"
      :model-value="dateRange"
      type="daterange"
      value-format="YYYY-MM-DD"
      range-separator="至"
      :start-placeholder="`${dateLabel}开始`"
      :end-placeholder="`${dateLabel}结束`"
      clearable
      @update:model-value="changeDateRange"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { fetchProjectDetail, fetchProjectList, type ProjectRecord } from '@/api/project'

  const props = withDefaults(
    defineProps<{
      projectId?: number
      groupId?: number
      dateRange?: string[]
      showDate?: boolean
      dateLabel?: string
    }>(),
    { dateRange: () => [], showDate: true, dateLabel: '数据日期' }
  )
  const emit = defineEmits<{
    'update:projectId': [value: number | undefined]
    'update:groupId': [value: number | undefined]
    'update:dateRange': [value: string[]]
    change: []
  }>()

  const projects = ref<ProjectRecord[]>([])
  const groups = ref<Array<{ id: number; name: string }>>([])

  async function loadProjects() {
    projects.value = (await fetchProjectList({ current: 1, size: 100 })).list
  }
  async function loadGroups(projectId?: number) {
    const records = projectId ? (await fetchProjectDetail(projectId)).groups || [] : []
    groups.value = records.flatMap((group) =>
      typeof group.id === 'number' ? [{ id: group.id, name: group.name }] : []
    )
  }
  function changeProject(value: number | undefined) {
    emit('update:projectId', value || undefined)
    emit('update:groupId', undefined)
    emit('change')
  }
  function changeGroup(value: number | undefined) {
    emit('update:groupId', value || undefined)
    emit('change')
  }
  function changeDateRange(value: string[] | null) {
    emit('update:dateRange', value || [])
    emit('change')
  }

  watch(
    () => props.projectId,
    (projectId) => void loadGroups(projectId),
    { immediate: true }
  )
  void loadProjects()
</script>

<style scoped>
  .research-scope-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .research-scope-filter :deep(.el-select) {
    width: 170px;
  }
  .research-scope-filter :deep(.el-date-editor) {
    width: 250px;
  }
</style>
