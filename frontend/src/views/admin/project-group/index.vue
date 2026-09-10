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
        <div class="configuration-summary">
          <div>
            <span>用药方案</span>
            <strong>{{ form.medication?.snapshot.name || '未配置' }}</strong>
          </div>
          <div>
            <span>随访问卷</span>
            <strong>{{ form.surveys.length }} 项</strong>
          </div>
          <div>
            <span>任务模板</span>
            <strong>{{ form.tasks.length }} 项</strong>
          </div>
          <div>
            <span>提醒方案</span>
            <strong>{{ form.reminder?.snapshot.name || '未配置' }}</strong>
          </div>
        </div>
        <ElForm :model="form" label-position="top" :disabled="readonly || saving">
          <ElTabs v-model="activeTab" class="group-tabs">
            <ElTabPane label="患者" name="participants">
              <div class="participant-heading">
                <p class="muted">从这里新增患者时，当前研究和分组会自动带入。</p>
                <ElButton type="primary" :disabled="!form.medication" @click="addPatient">
                  新增患者
                </ElButton>
              </div>
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
                <ElTableColumn label="操作" width="90" fixed="right"
                  ><template #default="{ row }"
                    ><RouterLink
                      class="patient-detail-link"
                      :to="{ path: '/patient/detail', query: { user_id: String(row.id) } }"
                      >详情</RouterLink
                    ></template
                  ></ElTableColumn
                >
              </ElTable>
              <p class="muted">已有患者的归属由患者研究管理维护，此处用于查看当前结果。</p>
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
                  <ElFormItem v-if="!form.reminder" label="余药预警提前（天）"
                    ><ElInputNumber
                      v-model="form.medication.advance_days"
                      :min="0"
                      :max="form.medication.pickup_days"
                      :precision="0"
                  /></ElFormItem>
                  <ElFormItem v-else label="取药提醒提前量">
                    <ElInput
                      :model-value="
                        form.reminder.snapshot.pickup_enabled
                          ? `预计余药不足前 ${form.reminder.snapshot.pickup_advance_days} 天`
                          : '提醒方案未启用取药提醒'
                      "
                      disabled
                    />
                  </ElFormItem>
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
            <ElTabPane label="随访问卷" name="followup-surveys"
              ><Schedules
                v-model="form.surveys"
                :sources="catalog.surveys"
                label="问卷"
                :reminder-name="form.reminder?.snapshot.name"
            /></ElTabPane>
            <ElTabPane label="任务模板" name="followup-tasks"
              ><Schedules
                v-model="form.tasks"
                :sources="catalog.task_templates"
                label="任务模板"
                :reminder-name="form.reminder?.snapshot.name"
            /></ElTabPane>
            <ElTabPane label="提醒方案" name="reminder">
              <ElSelect
                :model-value="form.reminder?.id"
                placeholder="选择提醒方案"
                clearable
                filterable
                style="width: 100%"
                @change="selectReminder"
              >
                <ElOption
                  v-for="source in catalog.reminder_schemes"
                  :key="source.id"
                  :label="`${source.name}${source.status === 1 ? '' : '（已停用）'}`"
                  :value="source.id"
                  :disabled="source.status !== 1"
                />
              </ElSelect>
              <ElEmpty
                v-if="!form.reminder"
                description="暂未关联提醒方案，患者仍可在任务列表查看待办"
                :image-size="58"
              />
              <template v-else>
                <ElAlert
                  v-if="reminderOutdated"
                  title="提醒方案已有新版本，当前小组仍使用原版本"
                  description="确认新规则适合本组后，再更新为最新版。"
                  type="warning"
                  :closable="false"
                  show-icon
                  class="source-alert"
                >
                  <template #default>
                    <ElButton type="warning" link @click="refreshReminder">更新为最新版</ElButton>
                  </template>
                </ElAlert>
                <p class="muted reminder-description">{{ form.reminder.snapshot.description }}</p>
                <ElDescriptions :column="2" border class="reminder-detail">
                  <ElDescriptionsItem label="服药提醒">
                    {{ medicationReminder(form.reminder.snapshot) }}
                  </ElDescriptionsItem>
                  <ElDescriptionsItem label="任务提醒">
                    {{ taskReminder(form.reminder.snapshot) }}
                  </ElDescriptionsItem>
                  <ElDescriptionsItem label="任务提醒时间">
                    {{ form.reminder.snapshot.task_remind_time }}
                  </ElDescriptionsItem>
                  <ElDescriptionsItem label="取药提醒">
                    {{ pickupReminder(form.reminder.snapshot) }}
                  </ElDescriptionsItem>
                </ElDescriptions>
                <p class="muted">保存后，本组问卷和任务统一采用该提醒方案，不再逐条重复设置。</p>
              </template>
            </ElTabPane>
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
    reminder: null,
    surveys: [],
    tasks: [],
    participant_ids: []
  })
  const form = ref<GroupRecord>(blank())
  const catalog = ref<Catalog>({
    medication_schemes: [],
    reminder_schemes: [],
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
  const allowedTabs = [
    'participants',
    'medication',
    'followup-surveys',
    'followup-tasks',
    'reminder'
  ]
  const currentReminderSource = computed(() =>
    catalog.value.reminder_schemes.find((source) => source.id === form.value.reminder?.id)
  )
  const reminderOutdated = computed(
    () =>
      Boolean(currentReminderSource.value) &&
      currentReminderSource.value?.version !== form.value.reminder?.snapshot.version
  )
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
      if (!readonly.value && form.value.reminder) {
        syncMedicationPickupReminder(form.value.reminder.snapshot)
      }
      projectName.value = project.name
      const requestedTab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab
      activeTab.value = allowedTabs.includes(requestedTab || '')
        ? String(requestedTab)
        : 'participants'
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
      query: {
        project_id: projectId.value,
        id: groupId.value,
        mode: 'edit',
        tab: activeTab.value === 'participants' ? 'medication' : activeTab.value
      }
    })
  }
  function addPatient() {
    void router.push({
      path: '/patient/management',
      query: { project_id: projectId.value, group_id: groupId.value }
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
      advance_days: form.value.reminder?.snapshot.pickup_enabled
        ? form.value.reminder.snapshot.pickup_advance_days
        : (source.advance_days ?? 3),
      quantities: (source.drugs || []).map((d) => ({
        drug_id: d.drug_id,
        quantity: d.quantity ?? 30
      }))
    }
  }
  function selectReminder(id?: number) {
    if (!id) {
      form.value.reminder = null
      return
    }
    const source = catalog.value.reminder_schemes.find((item) => item.id === id)
    if (!source || source.id === form.value.reminder?.id) return
    form.value.reminder = { id, snapshot: JSON.parse(JSON.stringify(source)) }
    syncMedicationPickupReminder(source)
  }
  function refreshReminder() {
    const source = currentReminderSource.value
    if (!source || source.status !== 1) return
    form.value.reminder = { id: source.id, snapshot: JSON.parse(JSON.stringify(source)) }
    syncMedicationPickupReminder(source)
  }
  function syncMedicationPickupReminder(source: Catalog['reminder_schemes'][number]) {
    if (form.value.medication)
      form.value.medication.advance_days = source.pickup_enabled ? source.pickup_advance_days : 0
  }
  function medicationReminder(source: Catalog['reminder_schemes'][number]) {
    if (!source.medication_enabled) return '不提醒'
    return source.medication_advance_minutes
      ? `提前 ${source.medication_advance_minutes} 分钟`
      : '按服药时点'
  }
  function taskReminder(source: Catalog['reminder_schemes'][number]) {
    const stages = [
      source.task_start_enabled ? '开始' : '',
      source.task_due_enabled ? '到期' : '',
      source.task_overdue_enabled ? '逾期' : ''
    ].filter(Boolean)
    return stages.length ? stages.join('、') : '不提醒'
  }
  function pickupReminder(source: Catalog['reminder_schemes'][number]) {
    if (!source.pickup_enabled) return '不提醒'
    return `预计不足前 ${source.pickup_advance_days} 天 · ${source.pickup_remind_time}`
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
  .group-tabs {
    margin-top: 0;
  }
  .participant-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;
  }
  .configuration-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }
  .configuration-summary > div {
    min-width: 0;
    padding: 14px 16px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-fill-color-lighter);
  }
  .configuration-summary span,
  .configuration-summary strong {
    display: block;
  }
  .configuration-summary span {
    margin-bottom: 6px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
  .configuration-summary strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  .patient-detail-link {
    color: var(--el-color-primary);
    text-decoration: none;
  }
  .patient-detail-link:hover {
    color: var(--el-color-primary-light-3);
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 24px;
    margin-top: 16px;
  }
  .source-alert,
  .reminder-description,
  .reminder-detail {
    margin-top: 16px;
  }
  .footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
  }
  @media (max-width: 680px) {
    .configuration-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .fields {
      grid-template-columns: 1fr;
    }
    .reminder-detail :deep(.el-descriptions__body) {
      overflow-x: auto;
    }
  }
</style>
