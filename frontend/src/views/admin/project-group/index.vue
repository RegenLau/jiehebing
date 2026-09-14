<template>
  <div class="group-page">
    <div class="heading"
      ><div
        ><ElButton link type="primary" :disabled="saving" @click="back">返回分组列表</ElButton
        ><h2>{{ form.name }} · {{ readonly ? '分组详情' : '配置方案与任务' }}</h2
        ><p>{{ projectName }}</p></div
      ><ElButton v-if="readonly && loaded && !projectEnded" type="primary" @click="configureGroup"
        >配置方案与任务</ElButton
      ></div
    >
    <div v-loading="opening" class="group-body">
      <ElResult v-if="error" icon="warning" title="无法加载分组" :sub-title="error"
        ><template #extra><ElButton @click="loadPage">重试</ElButton></template></ElResult
      >
      <template v-else-if="loaded">
        <ElAlert
          v-if="projectEnded"
          class="readonly-alert"
          type="info"
          :closable="false"
          show-icon
          title="项目已结束，当前分组的患者、用药和任务配置仅供查看。"
        />
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
            <span>取药提醒</span>
            <strong>{{
              form.medication
                ? `提前 ${form.medication.advance_days} 天 · ${form.pickup_remind_time}`
                : '未配置'
            }}</strong>
          </div>
          <div>
            <span>其他任务</span>
            <strong>{{ form.tasks.length }} 项</strong>
          </div>
        </div>
        <ElForm :model="form" label-position="top" :disabled="readonly || saving">
          <ElTabs v-model="activeTab" class="group-tabs">
            <ElTabPane label="患者" name="participants">
              <div class="participant-heading">
                <p class="muted">{{
                  projectEnded
                    ? '项目已结束，不能继续新增患者。'
                    : '从这里新增患者时，当前研究和分组会自动带入。'
                }}</p>
                <ElButton
                  v-if="!projectEnded"
                  type="primary"
                  :disabled="!form.medication"
                  @click="addPatient"
                >
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
              <MedicationEditor
                context="group"
                ref="medicationEditor"
                v-model="form.medication"
                :sources="catalog.medication_schemes"
                :group-name="form.name"
                :readonly="readonly"
                :disabled="saving"
                :advance-days="form.medication?.advance_days ?? defaultPickupAdvanceDays"
              />
            </ElTabPane>
            <ElTabPane label="随访问卷" name="followup-surveys">
              <Schedules v-model="form.surveys" :sources="catalog.surveys" label="问卷" />
            </ElTabPane>
            <ElTabPane label="取药提醒" name="pickup-reminder">
              <section class="pickup-rule-card">
                <div class="pickup-rule-heading">
                  <div>
                    <h3>取药提醒</h3>
                    <p>系统根据每位患者的实际发药量和个体用法用量，自动计算提醒日期。</p>
                  </div>
                  <ElTag type="primary" effect="light">系统自动计算</ElTag>
                </div>
                <ElAlert
                  v-if="!form.medication"
                  title="请先在“用药方案”中配置药品，随后再设置提前天数、提醒时间和要求说明。"
                  type="warning"
                  :closable="false"
                  show-icon
                />
                <div v-else class="pickup-rule-setting">
                  <ElFormItem label="提前提醒（天）">
                    <ElInputNumber
                      v-model="form.medication.advance_days"
                      :min="0"
                      :max="60"
                      :precision="0"
                    />
                  </ElFormItem>
                  <ElFormItem label="提醒时间（必填）">
                    <ElTimePicker
                      v-model="form.pickup_remind_time"
                      format="HH:mm"
                      value-format="HH:mm"
                      placeholder="选择时间"
                    />
                  </ElFormItem>
                  <ElFormItem label="要求说明（必填）">
                    <ElInput
                      v-model="form.pickup_requirements"
                      type="textarea"
                      :rows="3"
                      maxlength="1000"
                      show-word-limit
                      placeholder="填写患者收到取药提醒后需要完成的事项"
                    />
                  </ElFormItem>
                  <p>
                    每日用量＝单次用量 × 每日服药次数；多种药品按最早预计不足的药品触发。
                    登记实际发药或余药盘点后，提醒日期会自动重算。
                  </p>
                </div>
              </section>
            </ElTabPane>
            <ElTabPane label="其他任务" name="other-tasks">
              <div class="scheduled-task-heading">
                <h3>检查、复诊及其他任务</h3>
                <p>以下任务按时间基准、频次和完成期限生成。</p>
              </div>
              <Schedules v-model="form.tasks" :sources="scheduledTaskTemplates" label="其他任务" />
            </ElTabPane>
          </ElTabs>
        </ElForm>
        <div v-if="!readonly" class="footer"
          ><span :class="{ dirty: hasUnsavedChanges }">{{
            hasUnsavedChanges
              ? '有未保存修改；保存后仅作为新患者默认安排'
              : '当前配置已保存'
          }}</span
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
    type GroupRecord,
    type ProjectStatus,
    type Schedule
  } from '@/api/project'
  import Schedules from '../project/modules/schedules.vue'
  import MedicationEditor from '@/components/business/medication-editor.vue'
  defineOptions({ name: 'ProjectGroup' })
  const route = useRoute(),
    router = useRouter()
  const projectId = computed(() => Number(route.query.project_id))
  const groupId = computed(() => (route.query.id === undefined ? 0 : Number(route.query.id)))
  const blank = (): GroupRecord => ({
    project_id: projectId.value,
    name: '',
    description: '',
    pickup_requirements: '',
    pickup_remind_time: '09:00',
    medication: null,
    reminder: null,
    surveys: [],
    tasks: [],
    participant_ids: []
  })
  const form = ref<GroupRecord>(blank())
  const medicationEditor = ref<InstanceType<typeof MedicationEditor>>()
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
    projectName = ref(''),
    projectStatus = ref<ProjectStatus>()
  const projectEnded = computed(() => projectStatus.value === 2)
  const readonly = computed(
    () => projectEnded.value || (Boolean(groupId.value) && route.query.mode !== 'edit')
  )
  const activeTab = ref('participants')
  const savedSnapshot = ref('')
  const hasUnsavedChanges = computed(
    () => Boolean(savedSnapshot.value) && JSON.stringify(form.value) !== savedSnapshot.value
  )
  const allowedTabs = [
    'participants',
    'medication',
    'followup-surveys',
    'pickup-reminder',
    'other-tasks'
  ]
  const scheduledTaskTemplates = computed(() =>
    catalog.value.task_templates.filter((source) => source.system_kind !== 'pickup')
  )
  const defaultPickupAdvanceDays = computed(() =>
    form.value.reminder?.snapshot.pickup_enabled
      ? form.value.reminder.snapshot.pickup_advance_days
      : 3
  )
  function normalizeSchedule(row: Schedule, fallbackTime: string): Schedule {
    return {
      ...row,
      remind_time: row.remind_time || fallbackTime
    }
  }
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
      const fallbackTime = record.reminder?.snapshot.task_remind_time || '09:00'
      form.value = {
        ...record,
        participant_ids: record.participant_ids || [],
        surveys: (record.surveys || []).map((item) => normalizeSchedule(item, fallbackTime)),
        tasks: (record.tasks || [])
          .filter((task) => task.snapshot.system_kind !== 'pickup')
          .map((item) => normalizeSchedule(item, fallbackTime))
      }
      savedSnapshot.value = JSON.stringify(form.value)
      projectName.value = project.name
      projectStatus.value = project.status
      const requestedTab = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab
      const normalizedTab = requestedTab === 'followup-tasks' ? 'other-tasks' : requestedTab
      activeTab.value = allowedTabs.includes(normalizedTab || '')
        ? String(normalizedTab)
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
    if (projectEnded.value) return
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
    if (projectEnded.value) return
    void router.push({
      path: '/patient/management',
      query: { project_id: projectId.value, group_id: groupId.value }
    })
  }
  watch(() => route.fullPath, loadPage, { immediate: true })
  onBeforeRouteLeave(() => !saving.value)
  async function save() {
    if (readonly.value || saving.value) return
    if (!form.value.pickup_requirements.trim()) {
      activeTab.value = 'pickup-reminder'
      ElMessage.warning('请填写取药提醒的要求说明')
      return
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.value.pickup_remind_time)) {
      activeTab.value = 'pickup-reminder'
      ElMessage.warning('请选择取药提醒时间')
      return
    }
    if (!medicationEditor.value?.validate()) {
      activeTab.value = 'medication'
      return
    }
    if ([...form.value.surveys, ...form.value.tasks].some((s) => s.anchor === 'date' && !s.date)) {
      ElMessage.warning('请填写指定执行日期')
      return
    }
    if (
      [...form.value.surveys, ...form.value.tasks].some(
        (s) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.remind_time)
      )
    ) {
      ElMessage.warning('请为每项问卷和任务选择提醒时间')
      return
    }
    saving.value = true
    try {
      const saved = await saveGroup(form.value)
      saving.value = false
      await router.replace({
        path: '/project/group',
        query: { project_id: projectId.value, id: saved.id, tab: activeTab.value }
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
  .readonly-alert {
    margin-bottom: 16px;
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
  .group-tabs > :deep(.el-tabs__header .el-tabs__item) {
    font-size: 16px;
    height: 52px;
    padding: 0 28px;
  }
  .group-tabs > :deep(.el-tabs__content) {
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
  .pickup-rule-card {
    padding: 18px;
    border: 1px solid var(--el-color-primary-light-7);
    border-radius: 8px;
    background: var(--el-color-primary-light-9);
  }
  .pickup-rule-setting {
    display: grid;
    grid-template-columns: 180px 200px minmax(0, 1fr);
    gap: 0 20px;
    align-items: start;
  }
  .pickup-rule-setting :deep(.el-date-editor.el-input) {
    width: 100%;
  }
  .pickup-rule-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
  }
  .pickup-rule-heading h3,
  .scheduled-task-heading h3 {
    margin: 0 0 6px;
  }
  .pickup-rule-heading p,
  .pickup-rule-setting p,
  .scheduled-task-heading p {
    margin: 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.7;
  }
  .pickup-rule-card > .el-alert,
  .pickup-rule-setting {
    margin-top: 16px;
  }
  .pickup-rule-setting :deep(.el-form-item) {
    margin-bottom: 0;
  }
  .pickup-rule-setting p {
    grid-column: 1 / -1;
    margin-top: 12px;
  }
  .scheduled-task-heading {
    margin: 24px 0 14px;
  }
  .footer {
    position: sticky;
    bottom: 0;
    z-index: 5;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding: 12px 16px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-bg-color);
    box-shadow: 0 -6px 18px rgb(0 0 0 / 6%);
  }
  .footer > span {
    margin-right: auto;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
  .footer > span.dirty {
    color: var(--el-color-warning);
  }
  @media (max-width: 680px) {
    .configuration-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .pickup-rule-heading,
    .pickup-rule-setting {
      display: block;
    }
    .pickup-rule-heading .el-tag {
      margin-top: 10px;
    }
    .pickup-rule-setting p {
      padding-top: 0;
    }
  }
</style>
