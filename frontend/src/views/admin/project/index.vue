<template>
  <div class="project-page">
    <div class="heading"
      ><div><h2>研究管理</h2><p>建立研究项目，在研究分组中关联通用方案和随访内容。</p></div
      ><ElButton type="primary" @click="edit()">新增项目</ElButton></div
    >
    <ElCard shadow="never">
      <div class="filters"
        ><ElInput
          v-model.trim="search.keyword"
          placeholder="搜索项目编号或名称"
          clearable
          style="width: 320px"
          @keyup.enter="query"
          @clear="query"
        /><ElSelect
          v-model="search.status"
          placeholder="全部状态"
          clearable
          style="width: 150px"
          @change="query"
          ><ElOption
            v-for="s in statuses"
            :key="s.value"
            :label="s.label"
            :value="s.value" /></ElSelect
        ><ElButton type="primary" @click="query">查询</ElButton
        ><ElButton @click="reset">重置</ElButton
        ><ElButton :loading="loading" @click="load">刷新</ElButton></div
      >
      <ElTable v-loading="loading" :data="list" border empty-text="暂无符合条件的项目">
        <ElTableColumn prop="code" label="项目编号" min-width="140" /><ElTableColumn
          prop="name"
          label="项目名称"
          min-width="220"
          show-overflow-tooltip
        />
        <ElTableColumn label="研究周期" min-width="210"
          ><template #default="{ row }"
            >{{ row.start_date }} 至 {{ row.end_date }}</template
          ></ElTableColumn
        >
        <ElTableColumn prop="group_count" label="分组数" width="80" />
        <ElTableColumn prop="patient_count" label="患者数" width="80" />
        <ElTableColumn label="状态" width="100"
          ><template #default="{ row }"
            ><ElTag :type="statusTagType(row.status)">{{
              statusLabel(row.status)
            }}</ElTag></template
          ></ElTableColumn
        >
        <ElTableColumn label="操作" width="240" fixed="right"
          ><template #default="{ row }"
            ><ElButton
              link
              type="primary"
              @click="router.push({ path: '/project/groups', query: { project_id: row.id } })"
              >分组</ElButton
            ><ElButton
              link
              type="primary"
              :disabled="row.status === 2"
              :title="row.status === 2 ? '项目已结束，仅支持查看' : '编辑项目'"
              @click="edit(row.id)"
              >编辑</ElButton
            ><ElButton link type="primary" :disabled="row.status === 2" @click="openStatus(row.id)"
              >状态</ElButton
            ><ElButton
              link
              type="danger"
              :loading="deletingProjectId === row.id"
              :disabled="!canDeleteProject(row)"
              :title="deleteProjectTitle(row)"
              @click="removeProject(row)"
              >删除</ElButton
            ></template
          ></ElTableColumn
        >
      </ElTable>
      <div class="pagination"
        ><ElPagination
          v-model:current-page="pager.current"
          v-model:page-size="pager.size"
          :total="pager.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @current-change="load"
          @size-change="query"
      /></div>
    </ElCard>
    <ElDialog
      v-model="formVisible"
      :title="form.id ? '编辑研究项目' : '新增研究项目'"
      width="min(720px,95vw)"
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :before-close="closeForm"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-position="top" :disabled="saving">
        <div class="fields"
          ><ElFormItem label="项目编号" prop="code"
            ><ElInput
              v-model.trim="form.code"
              maxlength="40"
              placeholder="例如 TB-2026-001" /></ElFormItem
          ><ElFormItem label="项目名称" prop="name"
            ><ElInput v-model.trim="form.name" maxlength="100"
          /></ElFormItem>
          <ElFormItem label="开始日期" prop="start_date"
            ><ElDatePicker v-model="form.start_date" value-format="YYYY-MM-DD" /></ElFormItem
          ><ElFormItem label="结束日期" prop="end_date"
            ><div class="date-field"
              ><ElDatePicker v-model="form.end_date" value-format="YYYY-MM-DD" />
              <span v-if="form.id" class="field-hint"
                >项目结束前可调整研究周期，结束后项目及分组将只读。</span
              ></div
            ></ElFormItem
          ></div
        >
        <ElFormItem label="研究目的"
          ><ElInput
            v-model.trim="form.purpose"
            type="textarea"
            :rows="3"
            maxlength="1000"
            show-word-limit /></ElFormItem></ElForm
      ><template #footer
        ><ElButton :disabled="saving" @click="formVisible = false">取消</ElButton
        ><ElButton type="primary" :loading="saving" @click="submit">保存</ElButton></template
      >
    </ElDialog>
    <ElDialog
      v-model="statusVisible"
      title="手动结束项目"
      width="480px"
      :close-on-click-modal="false"
      :close-on-press-escape="!statusSaving"
      :before-close="closeStatus"
      ><ElAlert
        class="status-warning"
        type="warning"
        :closable="false"
        show-icon
        title="项目手动结束后，项目里的患者将不能使用患者端小程序。"
      />
      <ElForm label-position="top" :disabled="statusSaving"
        ><ElFormItem label="结束原因"
          ><ElInput
            v-model.trim="reason"
            type="textarea"
            maxlength="300"
            placeholder="请填写手动结束原因"
            show-word-limit /></ElFormItem></ElForm
      ><template #footer
        ><ElButton :disabled="statusSaving" @click="statusVisible = false">取消</ElButton
        ><ElButton type="danger" :loading="statusSaving" @click="submitStatus"
          >确认结束</ElButton
        ></template
      ></ElDialog
    >
  </div>
</template>
<script setup lang="ts">
  import { nextTick, onActivated, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
  import {
    fetchProjectList,
    fetchProjectDetail,
    saveProject,
    changeProjectStatus,
    deleteProject,
    type ProjectPayload,
    type ProjectRecord,
    type ProjectStatus
  } from '@/api/project'
  import { useRouter } from 'vue-router'
  const router = useRouter()
  defineOptions({ name: 'ProjectIndex' })
  const statuses = [
    { value: 0, label: '未开始' },
    { value: 1, label: '进行中' },
    { value: 2, label: '已结束' }
  ]
  const statusLabel = (v: number) => statuses.find((s) => s.value === v)?.label || '未知'
  const statusTagType = (v: ProjectStatus) => (v === 0 ? 'warning' : v === 1 ? 'success' : 'info')
  const blank = (): ProjectPayload => ({
    code: '',
    name: '',
    start_date: '',
    end_date: '',
    purpose: ''
  })
  const list = ref<ProjectRecord[]>([]),
    loading = ref(false)
  const pager = reactive({ current: 1, size: 10, total: 0 }),
    search = reactive({ keyword: '', status: undefined as ProjectStatus | undefined })
  const form = ref(blank()),
    formRef = ref<FormInstance>(),
    formVisible = ref(false),
    saving = ref(false)
  const statusVisible = ref(false),
    statusSaving = ref(false),
    statusProject = ref<ProjectRecord>(),
    reason = ref('')
  const deletingProjectId = ref<number>()
  let request = 0,
    editRequest = 0
  const rules: FormRules = {
    code: [
      { required: true, message: '请填写项目编号' },
      { pattern: /^[A-Za-z0-9][A-Za-z0-9_-]*$/, message: '编号仅支持字母、数字、短横线和下划线' }
    ],
    name: [{ required: true, message: '请填写项目名称' }],
    start_date: [{ required: true, message: '请选择开始日期' }],
    end_date: [{ required: true, message: '请选择结束日期' }]
  }
  async function load() {
    const seq = ++request
    loading.value = true
    try {
      const r = await fetchProjectList({ ...search, current: pager.current, size: pager.size })
      if (seq !== request) return
      list.value = r.list
      pager.total = r.total
    } catch {
      if (seq === request) {
        list.value = []
        pager.total = 0
      }
    } finally {
      if (seq === request) loading.value = false
    }
  }
  function query() {
    pager.current = 1
    void load()
  }
  function reset() {
    search.keyword = ''
    search.status = undefined
    query()
  }
  function closeForm(done: () => void) {
    if (!saving.value) done()
  }
  function closeStatus(done: () => void) {
    if (!statusSaving.value) done()
  }
  async function edit(id?: number) {
    const seq = ++editRequest
    try {
      const r = id ? await fetchProjectDetail(id) : blank()
      if (seq !== editRequest) return
      if (id && (r as ProjectRecord).status === 2) {
        ElMessage.info('项目已结束，仅支持查看')
        return
      }
      form.value = {
        id: r.id,
        code: r.code,
        name: r.name,
        start_date: r.start_date,
        end_date: r.end_date,
        purpose: r.purpose
      }
      formVisible.value = true
      await nextTick()
      formRef.value?.clearValidate()
    } catch {
      /* 请求层提示 */
    }
  }
  async function submit() {
    if (saving.value || !(await formRef.value?.validate().catch(() => false))) return
    if (form.value.end_date < form.value.start_date) {
      ElMessage.warning('结束日期不能早于开始日期')
      return
    }
    saving.value = true
    try {
      await saveProject(form.value)
      formVisible.value = false
      query()
    } catch {
      /* 保留表单 */
    } finally {
      saving.value = false
    }
  }
  async function openStatus(id: number) {
    try {
      statusProject.value = await fetchProjectDetail(id)
      if (statusProject.value.status === 2) {
        ElMessage.info('项目已结束，无需重复操作')
        return
      }
      reason.value = ''
      statusVisible.value = true
    } catch {
      /* 请求层提示 */
    }
  }
  async function submitStatus() {
    if (statusSaving.value) return
    if (!reason.value) {
      ElMessage.warning('请填写手动结束原因')
      return
    }
    statusSaving.value = true
    try {
      await changeProjectStatus(
        statusProject.value!.id,
        2,
        reason.value,
        statusProject.value!.status
      )
      statusVisible.value = false
      await load()
    } catch {
      /* 请求层提示 */
    } finally {
      statusSaving.value = false
    }
  }
  function canDeleteProject(value: unknown) {
    const row = value as ProjectRecord
    return (
      row.status !== 2 && (row.can_delete ?? (row.group_count === 0 && row.patient_count === 0))
    )
  }
  function deleteProjectTitle(value: unknown) {
    const row = value as ProjectRecord
    if (row.status === 2) return '项目已结束，仅支持查看'
    return canDeleteProject(row) ? '删除空项目' : '项目仍有分组或患者，不能删除'
  }
  async function removeProject(value: unknown) {
    const row = value as ProjectRecord
    if (!canDeleteProject(row) || deletingProjectId.value) return
    const confirmed = await ElMessageBox.confirm(
      `确认删除空项目“${row.name}”？删除后无法恢复。`,
      '删除项目',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger'
      }
    )
      .then(() => true)
      .catch(() => false)
    if (!confirmed) return
    deletingProjectId.value = row.id
    try {
      await deleteProject(row.id)
      if (list.value.length === 1 && pager.current > 1) pager.current -= 1
      await load()
    } catch {
      /* 请求层提示 */
    } finally {
      deletingProjectId.value = undefined
    }
  }
  onActivated(load)
</script>
<style scoped>
  .project-page {
    min-width: 0;
    padding: 20px;
  }

  .heading,
  .filters {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 20px;
  }

  .heading {
    justify-content: space-between;
  }

  .heading h2 {
    margin: 0;
    font-size: 22px;
  }

  .heading p {
    color: var(--el-text-color-secondary);
  }

  .filters {
    flex-wrap: wrap;
  }

  .pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }

  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 20px;
  }

  .fields :deep(.el-date-editor),
  .fields :deep(.el-select) {
    width: 100%;
  }

  .date-field {
    width: 100%;
  }

  .field-hint {
    display: block;
    margin-top: 6px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
  }

  .status-warning {
    margin-bottom: 18px;
  }
</style>
