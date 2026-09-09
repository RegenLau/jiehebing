<template>
  <div class="group-page">
    <div class="heading"
      ><div
        ><ElButton link type="primary" :disabled="saving" @click="back">返回分组列表</ElButton
        ><h2>{{ readonly ? form.name + ' · 分组详情' : groupId ? '编辑分组' : '新建研究分组' }}</h2
        ><p>{{ projectName }}</p></div
      ><ElButton v-if="readonly && loaded" type="primary" @click="editGroup"
        >编辑分组</ElButton
      ></div
    >
    <ElCard v-loading="opening" shadow="never">
      <ElResult v-if="error" icon="warning" title="无法加载分组" :sub-title="error"
        ><template #extra><ElButton @click="loadPage">重试</ElButton></template></ElResult
      >
      <template v-else-if="loaded">
        <ElForm ref="formRef" :model="form" label-position="top" :disabled="readonly || saving">
          <div class="fields">
            <ElFormItem
              label="分组名称"
              prop="name"
              :rules="[{ required: true, message: '请填写分组名称', trigger: 'blur' }]"
              ><ElInput v-model.trim="form.name" maxlength="60" placeholder="例如 A 组"
            /></ElFormItem>
            <ElFormItem label="分组说明"
              ><ElInput
                v-model.trim="form.description"
                maxlength="1000"
                placeholder="说明本组适用范围"
            /></ElFormItem>
          </div>
          <ElCollapse v-model="sections">
            <ElCollapseItem title="用药方案与发药条件" name="medication">
              <ElSelect
                :model-value="form.medication?.id"
                placeholder="选择通用用药方案"
                clearable
                filterable
                style="width: 100%"
                @change="selectMedication"
              >
                <ElOption
                  v-for="s in catalog.medication_schemes"
                  :key="s.id"
                  :label="`${s.name}${s.status === 1 ? '' : '（已停用）'}`"
                  :value="s.id"
                  :disabled="s.status !== 1"
                />
              </ElSelect>
              <template v-if="form.medication">
                <p class="muted">{{ form.medication.snapshot.description }}</p>
                <ElTable :data="form.medication.snapshot.drugs" border>
                  <ElTableColumn label="药品" min-width="160"
                    ><template #default="{ row }"
                      >{{ row.name }}<div class="muted">{{ row.specification }}</div></template
                    ></ElTableColumn
                  >
                  <ElTableColumn label="用法" min-width="160"
                    ><template #default="{ row }"
                      >{{ row.dose }}{{ row.unit }} / 次 · {{ row.frequency }} ·
                      {{ row.times }}</template
                    ></ElTableColumn
                  >
                  <ElTableColumn
                    prop="precautions"
                    label="注意事项"
                    min-width="150"
                    show-overflow-tooltip
                  />
                </ElTable>
                <div class="fields">
                  <ElFormItem label="默认治疗天数"
                    ><ElInputNumber
                      v-model="form.medication.treatment_days"
                      :min="1"
                      :max="3650"
                      :precision="0"
                  /></ElFormItem>
                  <ElFormItem label="默认取药周期（天）"
                    ><ElInputNumber
                      v-model="form.medication.pickup_days"
                      :min="1"
                      :max="3650"
                      :precision="0"
                  /></ElFormItem>
                  <ElFormItem label="提前提醒取药（天）"
                    ><ElInputNumber
                      v-model="form.medication.advance_days"
                      :min="0"
                      :max="form.medication.pickup_days"
                      :precision="0"
                  /></ElFormItem>
                  <ElFormItem
                    v-for="q in form.medication.quantities"
                    :key="q.drug_id"
                    :label="`${drugName(q.drug_id)}首次发药（${drugUnit(q.drug_id)}）`"
                    ><ElInputNumber v-model="q.quantity" :min="1" :max="100000" :precision="0"
                  /></ElFormItem>
                </div>
                <p class="muted">以上是本组默认条件，实际发药以患者发药登记为准。</p>
              </template>
            </ElCollapseItem>
            <ElCollapseItem title="随访问卷与执行安排" name="surveys"
              ><Schedules v-model="form.surveys" :sources="catalog.surveys" label="问卷"
            /></ElCollapseItem>
            <ElCollapseItem title="检查等任务与执行安排" name="tasks"
              ><Schedules v-model="form.tasks" :sources="catalog.task_templates" label="任务模板"
            /></ElCollapseItem>
            <ElCollapseItem title="健康科普与通知人员" name="other">
              <ElFormItem label="关联健康科普"
                ><ElSelect
                  v-model="articleIds"
                  multiple
                  filterable
                  placeholder="选择已上架文章"
                  style="width: 100%"
                  ><ElOption
                    v-for="s in catalog.articles"
                    :key="s.id"
                    :label="s.name"
                    :value="s.id"
                    :disabled="s.status !== 1" /></ElSelect
              ></ElFormItem>
              <p v-for="a in form.articles" :key="a.id"
                >{{ a.snapshot.name || a.snapshot.title }}：{{
                  a.snapshot.description || a.snapshot.summary
                }}</p
              >
              <ElFormItem label="通知接收人员"
                ><ElSelect
                  v-model="form.contact_ids"
                  multiple
                  filterable
                  placeholder="选择启用账号"
                  style="width: 100%"
                  ><ElOption
                    v-for="s in catalog.contacts"
                    :key="s.id"
                    :label="`${s.name} · ${s.description}`"
                    :value="s.id"
                    :disabled="s.status !== 1" /></ElSelect
              ></ElFormItem>
              <p class="muted">当前配置用于安排通知接收对象，保存不会发送通知。</p>
            </ElCollapseItem>
          </ElCollapse>
        </ElForm>
        <div v-if="!readonly" class="footer"
          ><ElButton :disabled="saving" @click="back">返回分组列表</ElButton
          ><ElButton type="primary" :loading="saving" @click="save">保存分组</ElButton></div
        >
      </template>
    </ElCard>
  </div>
</template>
<script setup lang="ts">
  import { computed, nextTick, ref, watch } from 'vue'
  import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
  import { ElMessage, type FormInstance } from 'element-plus'
  import {
    fetchGroupDetail,
    fetchProjectDetail,
    fetchProjectCatalog,
    saveGroup,
    type Catalog,
    type GroupRecord
  } from '@/api/project'
  import Schedules from '../project/modules/schedules.vue'
  defineOptions({ name: 'ProjectGroup' })
  const route = useRoute(),
    router = useRouter()
  const projectId = computed(() => Number(route.query.project_id))
  const groupId = computed(() => (route.query.id === undefined ? 0 : Number(route.query.id)))
  const blank = (): GroupRecord => ({
    project_id: projectId.value,
    name: '',
    description: '',
    medication: null,
    surveys: [],
    tasks: [],
    articles: [],
    contact_ids: []
  })
  const form = ref<GroupRecord>(blank())
  const catalog = ref<Catalog>({
    medication_schemes: [],
    surveys: [],
    task_templates: [],
    articles: [],
    contacts: []
  })
  const saving = ref(false),
    opening = ref(false),
    loaded = ref(false),
    error = ref(''),
    projectName = ref('')
  const readonly = computed(() => Boolean(groupId.value) && route.query.mode !== 'edit')
  const formRef = ref<FormInstance>()
  const sections = ref(['medication', 'surveys', 'tasks', 'other'])
  const articleIds = computed({
    get: () => form.value.articles.map((a) => a.id),
    set: (ids: number[]) => {
      form.value.articles = ids.map(
        (id) =>
          form.value.articles.find((a) => a.id === id) || {
            id,
            snapshot: JSON.parse(JSON.stringify(catalog.value.articles.find((a) => a.id === id)))
          }
      )
    }
  })
  const drugName = (id: number) =>
    form.value.medication?.snapshot.drugs?.find((d) => d.drug_id === id)?.name || ''
  const drugUnit = (id: number) =>
    form.value.medication?.snapshot.drugs?.find((d) => d.drug_id === id)?.unit || ''
  let sequence = 0
  async function loadPage() {
    const seq = ++sequence
    opening.value = true
    loaded.value = false
    error.value = ''
    const pid = projectId.value,
      gid = groupId.value
    if (
      !Number.isSafeInteger(pid) ||
      pid <= 0 ||
      (route.query.id !== undefined && (!Number.isSafeInteger(gid) || gid <= 0))
    ) {
      error.value = '项目或分组编号不正确'
      opening.value = false
      return
    }
    try {
      const [sources, project, record] = await Promise.all([
        fetchProjectCatalog(),
        fetchProjectDetail(pid),
        gid ? fetchGroupDetail(pid, gid) : Promise.resolve(blank())
      ])
      if (seq !== sequence) return
      catalog.value = sources
      form.value = record
      projectName.value = project.name
      loaded.value = true
      await nextTick()
      formRef.value?.clearValidate()
    } catch {
      if (seq === sequence) error.value = '分组加载失败，请核对项目和分组后重试'
    } finally {
      if (seq === sequence) opening.value = false
    }
  }
  function back() {
    void router.push({ path: '/project/groups', query: { project_id: projectId.value } })
  }
  function editGroup() {
    void router.push({
      path: '/project/group',
      query: { project_id: projectId.value, id: groupId.value, mode: 'edit' }
    })
  }
  watch(() => route.fullPath, loadPage, { immediate: true })
  onBeforeRouteLeave(() => !saving.value)
  function selectMedication(id?: number) {
    if (!id) {
      form.value.medication = null
      return
    }
    const source = catalog.value.medication_schemes.find((s) => s.id === id)
    if (!source || source.id === form.value.medication?.id) return
    form.value.medication = {
      id,
      snapshot: JSON.parse(JSON.stringify(source)),
      treatment_days: 30,
      pickup_days: 30,
      advance_days: 3,
      quantities: (source.drugs || []).map((d) => ({ drug_id: d.drug_id, quantity: 30 }))
    }
  }
  async function save() {
    if (readonly.value || saving.value || !(await formRef.value?.validate().catch(() => false)))
      return
    if ([...form.value.surveys, ...form.value.tasks].some((s) => s.anchor === 'date' && !s.date)) {
      ElMessage.warning('请填写指定执行日期')
      return
    }
    saving.value = true
    try {
      const saved = await saveGroup(form.value)
      saving.value = false
      await router.replace({
        path: '/project/group',
        query: { project_id: projectId.value, id: saved.id }
      })
    } catch {
      /* 保留表单 */
    } finally {
      saving.value = false
    }
  }
</script>
<style scoped>
  .group-page {
    padding: 20px;
    max-width: 1200px;
    margin: auto;
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
  .heading p,
  .muted {
    color: var(--el-text-color-secondary);
  }
  .muted {
    font-size: 12px;
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 24px;
    margin-top: 16px;
  }
  .footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
  }
  @media (max-width: 680px) {
    .fields {
      grid-template-columns: 1fr;
    }
  }
</style>
