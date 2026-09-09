<template>
  <div class="group-page">
    <div class="heading"
      ><div
        ><ElButton link type="primary" :disabled="saving" @click="back">返回分组列表</ElButton
        ><h2>{{ form.name }} · {{ readonly ? '分组详情' : '配置方案与任务' }}</h2
        ><p>{{ projectName }}</p></div
      ><ElButton v-if="readonly && loaded" type="primary" @click="configureGroup"
        >配置方案与任务</ElButton
      ></div
    >
    <div v-loading="opening" class="group-body">
      <ElResult v-if="error" icon="warning" title="无法加载分组" :sub-title="error"
        ><template #extra><ElButton @click="loadPage">重试</ElButton></template></ElResult
      >
      <template v-else-if="loaded">
        <ElForm :model="form" label-position="top" :disabled="readonly || saving">
          <div class="basic-info">
            <h3>{{ form.name }}</h3>
            <p>{{ form.description || '暂无分组说明' }}</p>
            <span class="muted"
              >患者 {{ form.participant_ids.length }} 人 · 分组第 {{ form.revision }} 版</span
            >
          </div>
          <ElTabs v-model="activeTab" class="group-tabs">
            <ElTabPane label="患者" name="participants">
              <ElTable :data="form.participants || []" border empty-text="暂无已入组患者">
                <ElTableColumn label="患者编号" min-width="140"
                  ><template #default="{ row }">{{
                    row.patient_code || '-'
                  }}</template></ElTableColumn
                >
                <ElTableColumn prop="name" label="姓名" min-width="100" />
                <ElTableColumn prop="mobile" label="手机号" min-width="140" />
                <ElTableColumn label="入组日期" min-width="120"
                  ><template #default="{ row }">{{
                    row.enroll_date || '-'
                  }}</template></ElTableColumn
                >
                <ElTableColumn label="研究状态" min-width="110"
                  ><template #default="{ row }">{{
                    row.study_state || '待启用'
                  }}</template></ElTableColumn
                >
              </ElTable>
              <p class="muted">患者入组关系由患者建档或研究登记维护，此处仅展示当前结果。</p>
            </ElTabPane>
            <ElTabPane label="用药方案" name="medication">
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
            </ElTabPane>
            <ElTabPane label="随访任务" name="followup"
              ><Schedules v-model="form.surveys" :sources="catalog.surveys" label="问卷" /><h4
                >检查、复诊及其他任务</h4
              ><Schedules v-model="form.tasks" :sources="catalog.task_templates" label="任务模板"
            /></ElTabPane>
          </ElTabs>
        </ElForm>
        <div v-if="!readonly" class="footer"
          ><ElButton :disabled="saving" @click="back">返回分组列表</ElButton
          ><ElButton type="primary" :loading="saving" @click="save">保存方案与任务</ElButton></div
        >
      </template>
    </div>
  </div>
</template>
<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
  import { ElMessage } from 'element-plus'
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
    participant_ids: []
  })
  const form = ref<GroupRecord>(blank())
  const catalog = ref<Catalog>({
    medication_schemes: [],
    surveys: [],
    task_templates: []
  })
  const saving = ref(false),
    opening = ref(false),
    loaded = ref(false),
    error = ref(''),
    projectName = ref('')
  const readonly = computed(() => Boolean(groupId.value) && route.query.mode !== 'edit')
  const activeTab = ref('participants')
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
    if (route.query.id === undefined && Number.isSafeInteger(pid) && pid > 0) {
      await router.replace({ path: '/project/groups', query: { project_id: pid, create: '1' } })
      return
    }
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
        fetchGroupDetail(pid, gid)
      ])
      if (seq !== sequence) return
      catalog.value = sources
      form.value = { ...record, participant_ids: record.participant_ids || [] }
      projectName.value = project.name
      activeTab.value = readonly.value ? 'participants' : 'medication'
      loaded.value = true
    } catch {
      if (seq === sequence) error.value = '分组加载失败，请核对项目和分组后重试'
    } finally {
      if (seq === sequence) opening.value = false
    }
  }
  function back() {
    void router.push({ path: '/project/groups', query: { project_id: projectId.value } })
  }
  function configureGroup() {
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
      treatment_days: source.treatment_days ?? 30,
      pickup_days: source.pickup_days ?? 30,
      advance_days: source.advance_days ?? 3,
      quantities: (source.drugs || []).map((d) => ({
        drug_id: d.drug_id,
        quantity: d.quantity ?? 30
      }))
    }
  }
  async function save() {
    if (readonly.value || saving.value) return
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
  .basic-info {
    padding: 24px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-bg-color);
  }
  .basic-info h3 {
    margin: 0 0 12px;
  }
  .basic-info p {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .group-tabs {
    margin-top: 24px;
  }
  .group-tabs :deep(.el-tabs__item) {
    font-size: 16px;
    height: 52px;
    padding: 0 28px;
  }
  .group-tabs :deep(.el-tabs__content) {
    padding: 24px;
    min-height: 320px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-bg-color);
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
