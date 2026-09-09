<template>
  <div class="groups-page">
    <div class="heading"
      ><div
        ><ElButton link type="primary" @click="router.push('/project/index')">返回项目列表</ElButton
        ><h2>{{ project?.name || '研究项目' }} · 研究分组</h2
        ><p>选择已有小组查看详情，或新建研究分组。</p></div
      ><ElButton v-if="project" type="primary" @click="openGroup()">新建分组</ElButton></div
    >
    <ElCard v-loading="loading" shadow="never">
      <ElResult v-if="error" icon="warning" title="无法加载研究分组" :sub-title="error"
        ><template #extra><ElButton @click="load">重试</ElButton></template></ElResult
      >
      <template v-else-if="project">
        <ElEmpty v-if="!project.groups?.length" description="当前项目还没有分组"
          ><ElButton type="primary" @click="openGroup()">创建第一个分组</ElButton></ElEmpty
        >
        <ElTable v-else :data="project.groups" border @row-click="(row) => openGroup(row.id)">
          <ElTableColumn label="分组名称" min-width="160"
            ><template #default="{ row }"
              ><ElButton link type="primary" @click.stop="openGroup(row.id)">{{
                row.name
              }}</ElButton></template
            ></ElTableColumn
          >
          <ElTableColumn
            prop="description"
            label="分组说明"
            min-width="160"
            show-overflow-tooltip
          />
          <ElTableColumn label="用药方案" min-width="180"
            ><template #default="{ row }">{{
              row.medication?.snapshot.name || '未配置'
            }}</template></ElTableColumn
          >
          <ElTableColumn label="配置情况" min-width="240"
            ><template #default="{ row }"
              >问卷 {{ row.surveys.length }} · 任务 {{ row.tasks.length }} · 科普
              {{ row.articles.length }} · 联系人 {{ row.contact_ids.length }}</template
            ></ElTableColumn
          >
          <ElTableColumn label="配置版本" width="100"
            ><template #default="{ row }">第 {{ row.revision }} 版</template></ElTableColumn
          >
          <ElTableColumn label="操作" width="110"
            ><template #default="{ row }"
              ><ElButton link type="primary" @click.stop="openGroup(row.id)"
                >进入分组</ElButton
              ></template
            ></ElTableColumn
          >
        </ElTable>
      </template>
    </ElCard>
  </div>
</template>
<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { fetchProjectDetail, type ProjectRecord } from '@/api/project'
  defineOptions({ name: 'ProjectGroups' })
  const route = useRoute(),
    router = useRouter(),
    project = ref<ProjectRecord>(),
    loading = ref(false),
    error = ref('')
  const projectId = computed(() => Number(route.query.project_id))
  let sequence = 0
  async function load() {
    const seq = ++sequence
    loading.value = true
    project.value = undefined
    error.value = ''
    try {
      if (!Number.isSafeInteger(projectId.value) || projectId.value <= 0) {
        error.value = '项目编号不正确'
        return
      }
      const result = await fetchProjectDetail(projectId.value)
      if (seq === sequence) project.value = result
    } catch {
      if (seq === sequence) error.value = '项目不存在或暂时无法加载'
    } finally {
      if (seq === sequence) loading.value = false
    }
  }
  function openGroup(id?: number) {
    void router.push({
      path: '/project/group',
      query: { project_id: projectId.value, ...(id ? { id } : {}) }
    })
  }
  watch(() => route.fullPath, load, { immediate: true })
</script>
<style scoped>
  .groups-page {
    padding: 20px;
  }
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 20px;
  }
  .heading h2 {
    margin: 12px 0 4px;
    font-size: 22px;
  }
  .heading p {
    color: var(--el-text-color-secondary);
  }
  .groups-page :deep(.el-table__row) {
    cursor: pointer;
  }
</style>
