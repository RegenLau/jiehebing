<template>
  <div class="groups-page">
    <div class="heading"
      ><div
        ><ElButton link type="primary" @click="router.push('/project/index')">返回项目列表</ElButton
        ><h2>{{ project?.name || '研究项目' }} · 研究分组</h2
        ><p>编辑分组基础信息，或进入分组查看患者并配置方案与任务。</p></div
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
        <ElTable v-else :data="project.groups" border>
          <ElTableColumn prop="name" label="分组名称" min-width="160" />
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
              >随访任务 {{ row.surveys.length + row.tasks.length }} · 患者
              {{ row.participant_ids?.length || 0 }}</template
            ></ElTableColumn
          >
          <ElTableColumn label="分组版本" width="100"
            ><template #default="{ row }">第 {{ row.revision }} 版</template></ElTableColumn
          >
          <ElTableColumn label="操作" width="180"
            ><template #default="{ row }"
              ><ElButton link type="primary" @click="openEdit(row)">编辑</ElButton
              ><ElButton link type="primary" @click="openGroup(row.id)"
                >进入分组</ElButton
              ></template
            ></ElTableColumn
          >
        </ElTable>
      </template>
    </ElCard>
    <ElDialog
      v-model="createVisible"
      title="新建分组"
      width="520px"
      :close-on-click-modal="false"
      :close-on-press-escape="!creating"
      :before-close="closeCreate"
    >
      <ElForm ref="createRef" :model="createForm" label-position="top" :disabled="creating">
        <ElFormItem
          label="分组名称"
          prop="name"
          :rules="[{ required: true, message: '请填写分组名称', trigger: 'blur' }]"
          ><ElInput v-model.trim="createForm.name" maxlength="60" placeholder="例如 A 组"
        /></ElFormItem>
        <ElFormItem label="分组说明"
          ><ElInput
            v-model.trim="createForm.description"
            type="textarea"
            :rows="3"
            maxlength="1000"
            show-word-limit
            placeholder="选填"
        /></ElFormItem>
      </ElForm>
      <p class="tip">创建后可进入分组配置用药方案和随访任务；患者在建档时加入分组。</p>
      <template #footer
        ><ElButton :disabled="creating" @click="createVisible = false">取消</ElButton
        ><ElButton type="primary" :loading="creating" @click="submitCreate"
          >创建分组</ElButton
        ></template
      >
    </ElDialog>
    <ElDialog
      v-model="editVisible"
      title="编辑分组"
      width="520px"
      :close-on-click-modal="false"
      :close-on-press-escape="!editing"
      :before-close="closeEdit"
    >
      <ElForm ref="editRef" :model="editForm" label-position="top" :disabled="editing">
        <ElFormItem
          label="分组名称"
          prop="name"
          :rules="[{ required: true, message: '请填写分组名称', trigger: 'blur' }]"
          ><ElInput v-model.trim="editForm.name" maxlength="60" placeholder="例如 A 组"
        /></ElFormItem>
        <ElFormItem label="分组说明"
          ><ElInput
            v-model.trim="editForm.description"
            type="textarea"
            :rows="3"
            maxlength="1000"
            show-word-limit
            placeholder="选填"
        /></ElFormItem>
      </ElForm>
      <template #footer
        ><ElButton :disabled="editing" @click="editVisible = false">取消</ElButton
        ><ElButton type="primary" :loading="editing" @click="submitEdit">保存</ElButton></template
      >
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import { computed, nextTick, reactive, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import {
    createGroup,
    fetchProjectDetail,
    saveGroupBasic,
    type GroupRecord,
    type ProjectRecord
  } from '@/api/project'
  import type { FormInstance } from 'element-plus'
  defineOptions({ name: 'ProjectGroups' })
  const route = useRoute(),
    router = useRouter(),
    project = ref<ProjectRecord>(),
    loading = ref(false),
    error = ref('')
  const projectId = computed(() => Number(route.query.project_id))
  const createVisible = ref(false),
    creating = ref(false),
    createRef = ref<FormInstance>()
  const createForm = reactive({ name: '', description: '' })
  const editVisible = ref(false),
    editing = ref(false),
    editRef = ref<FormInstance>(),
    editingGroup = ref<GroupRecord>()
  const editForm = reactive({ name: '', description: '' })
  let createProjectId = 0
  function closeCreate(done: () => void) {
    if (!creating.value) done()
  }
  async function submitCreate() {
    if (creating.value || !(await createRef.value?.validate().catch(() => false))) return
    creating.value = true
    try {
      await createGroup({ project_id: createProjectId, ...createForm })
      createVisible.value = false
      await router.replace({ path: '/project/groups', query: { project_id: createProjectId } })
      await load()
    } catch {
      /* 保留内容供修正 */
    } finally {
      creating.value = false
    }
  }
  function closeEdit(done: () => void) {
    if (!editing.value) done()
  }
  async function openEdit(value: unknown) {
    const row = value as GroupRecord
    editingGroup.value = row
    editForm.name = row.name
    editForm.description = row.description || ''
    editVisible.value = true
    await nextTick()
    editRef.value?.clearValidate()
  }
  async function submitEdit() {
    const row = editingGroup.value
    if (
      editing.value ||
      !row?.id ||
      row.revision === undefined ||
      !(await editRef.value?.validate().catch(() => false))
    )
      return
    editing.value = true
    try {
      await saveGroupBasic({
        id: row.id,
        project_id: row.project_id,
        revision: row.revision,
        name: editForm.name,
        description: editForm.description
      })
      editVisible.value = false
      await load()
    } catch {
      /* 保留内容供修正 */
    } finally {
      editing.value = false
    }
  }
  let sequence = 0
  async function load() {
    const seq = ++sequence
    loading.value = true
    project.value = undefined
    createVisible.value = false
    editVisible.value = false
    error.value = ''
    try {
      if (!Number.isSafeInteger(projectId.value) || projectId.value <= 0) {
        error.value = '项目编号不正确'
        return
      }
      const result = await fetchProjectDetail(projectId.value)
      if (seq === sequence) {
        project.value = result
        if (route.query.create === '1') await openGroup()
      }
    } catch {
      if (seq === sequence) error.value = '项目不存在或暂时无法加载'
    } finally {
      if (seq === sequence) loading.value = false
    }
  }
  async function openGroup(id?: number) {
    if (!id) {
      createProjectId = projectId.value
      createForm.name = ''
      createForm.description = ''
      createVisible.value = true
      await nextTick()
      createRef.value?.clearValidate()
      return
    }
    void router.push({
      path: '/project/group',
      query: { project_id: projectId.value, ...(id ? { id } : {}) }
    })
  }
  watch(() => route.fullPath, load, { immediate: true })
</script>
<style scoped>
  .tip {
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
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
</style>
