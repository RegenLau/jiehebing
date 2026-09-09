<template>
  <ElDialog
    v-model="visible"
    :title="form.id ? '患者研究管理' : '新增患者'"
    width="min(1000px,95vw)"
    :close-on-click-modal="false"
    :before-close="close"
    ><ElTabs v-model="tab"
      ><ElTabPane label="基础与入组" name="base"
        ><ElForm label-position="top" :disabled="saving"
          ><div class="grid"
            ><ElFormItem label="姓名"><ElInput v-model="form.name" /></ElFormItem
            ><ElFormItem label="手机号"><ElInput v-model="form.mobile" /></ElFormItem
            ><ElFormItem label="性别"
              ><ElSelect v-model="form.gender"
                ><ElOption label="男" :value="1" /><ElOption
                  label="女"
                  :value="2" /></ElSelect></ElFormItem
            ><ElFormItem label="年龄"
              ><ElInputNumber v-model="form.age" :min="0" :max="120" /></ElFormItem
            ><ElFormItem label="医院/中心"><ElInput v-model="form.hospital_name" /></ElFormItem
            ><ElFormItem label="科室"><ElInput v-model="form.department_name" /></ElFormItem
            ><ElFormItem label="研究项目"
              ><ElSelect
                v-model="form.project_id"
                :disabled="Boolean(originalProject)"
                @change="loadGroups"
                ><ElOption
                  v-for="p in projects"
                  :key="p.id"
                  :label="p.name"
                  :value="p.id" /></ElSelect></ElFormItem
            ><ElFormItem label="研究分组"
              ><ElSelect v-model="form.group_id" :disabled="Boolean(originalProject)"
                ><ElOption
                  v-for="g in groups"
                  :key="g.id"
                  :label="g.name"
                  :value="g.id!" /></ElSelect></ElFormItem
            ><ElFormItem label="负责人员"
              ><ElSelect v-model="form.owner_id"
                ><ElOption
                  v-for="a in owners"
                  :key="a.id"
                  :label="a.realname || a.username"
                  :value="a.id"
                  :disabled="a.status !== 1" /></ElSelect></ElFormItem
            ><ElFormItem label="入组基准日"
              ><ElDatePicker v-model="form.enroll_date" value-format="YYYY-MM-DD" /></ElFormItem
            ><ElFormItem label="知情同意日期"
              ><ElDatePicker
                v-model="form.consent_date"
                value-format="YYYY-MM-DD" /></ElFormItem></div
          ><div class="toolbar"
            ><ElCheckbox v-model="form.offline_confirmed">已在线下确认入组</ElCheckbox
            ><ElCheckbox v-model="form.consent_confirmed">已登记知情同意</ElCheckbox></div
          ><ElFormItem label="修改说明"><ElInput v-model="form.reason" /></ElFormItem></ElForm
        ><ElButton type="primary" :loading="saving" @click="saveBase">保存档案</ElButton></ElTabPane
      >
      <ElTabPane v-if="form.id" label="个体用药" name="treatment"
        ><p>从分组配置带出后，由医生确认患者实际方案。</p
        ><ElButton :disabled="saving" @click="fromGroup">带出分组方案</ElButton
        ><ElForm label-position="top" :disabled="saving"
          ><div class="grid"
            ><ElFormItem label="开始用药日期"
              ><ElDatePicker v-model="treatment.start_date" value-format="YYYY-MM-DD" /></ElFormItem
            ><ElFormItem label="治疗天数"
              ><ElInputNumber
                v-model="treatment.treatment_days"
                :min="1"
                :max="365" /></ElFormItem></div
          ><div v-for="d in treatment.drugs" :key="d.drug_id" class="drug"
            ><strong>{{ d.name }}</strong
            ><div class="grid"
              ><ElFormItem label="单次用量"><ElInput v-model="d.dose" /></ElFormItem
              ><ElFormItem label="单位"><ElInput v-model="d.unit" /></ElFormItem
              ><ElFormItem label="频次"><ElInput v-model="d.frequency" /></ElFormItem
              ><ElFormItem label="服药时间"
                ><ElInput v-model="d.times" placeholder="08:00,20:00" /></ElFormItem></div></div
          ><ElFormItem label="确认/调整原因"
            ><ElInput v-model="treatment.reason" /></ElFormItem></ElForm
        ><ElButton type="primary" :loading="saving" @click="saveTreatment">确认个体方案</ElButton
        ><h3>方案历史</h3
        ><ElTable :data="treatments"
          ><ElTableColumn prop="created_at" label="记录时间" /><ElTableColumn
            prop="start_date"
            label="开始" /><ElTableColumn prop="end_date" label="结束" /><ElTableColumn
            prop="reason"
            label="原因" /></ElTable
      ></ElTabPane>
      <ElTabPane v-if="form.id" label="实际发药" name="dispense"
        ><ElForm label-position="top" :disabled="saving"
          ><ElFormItem label="实际发药日期"
            ><ElDatePicker v-model="dispense.issued_date" value-format="YYYY-MM-DD" /></ElFormItem
          ><div v-for="d in dispense.items" :key="d.drug_id" class="toolbar"
            ><span>{{ d.name }}（{{ d.unit }}）</span
            ><ElInputNumber v-model="d.quantity" :min="0.001" /></div
          ><ElFormItem label="发药说明"><ElInput v-model="dispense.reason" /></ElFormItem></ElForm
        ><ElButton type="primary" :loading="saving" @click="saveDispense">登记实际发药</ElButton
        ><h3>发药记录</h3
        ><ElTable :data="dispensings"
          ><ElTableColumn prop="issued_date" label="实际日期" /><ElTableColumn label="药品与数量"
            ><template #default="{ row }">{{
              row.items.map((d: DispenseItem) => `${d.name} ${d.quantity}${d.unit}`).join('、')
            }}</template></ElTableColumn
          ><ElTableColumn prop="operator" label="操作人" /><ElTableColumn
            prop="reason"
            label="说明" /></ElTable
      ></ElTabPane>
      <ElTabPane v-if="form.id" label="预计余药" name="stock"
        ><p>按截至昨日的计划用量估算；未打卡不代表未服药，预计值需与患者核对。</p
        ><ElButton @click="loadStock">刷新余药</ElButton
        ><ElTable :data="stock"
          ><ElTableColumn prop="name" label="药品" /><ElTableColumn
            prop="estimated"
            label="预计余量"
          /><ElTableColumn prop="unit" label="单位" /><ElTableColumn
            prop="days"
            label="预计可用天数"
          /><ElTableColumn label="取药提醒"
            ><template #default="{ row }">{{
              row.needs_pickup ? '需联系取药' : '暂未到提醒窗口'
            }}</template></ElTableColumn
          ></ElTable
        ><ElForm label-position="top" :disabled="saving"
          ><ElFormItem label="盘点药品"
            ><ElSelect v-model="stockForm.drug_id"
              ><ElOption
                v-for="d in stock"
                :key="d.drug_id"
                :label="d.name"
                :value="d.drug_id" /></ElSelect></ElFormItem
          ><ElFormItem label="日终盘点日期（昨日或更早）"
            ><ElDatePicker v-model="stockForm.date" value-format="YYYY-MM-DD" /></ElFormItem
          ><ElFormItem label="日终实际余量"
            ><ElInputNumber v-model="stockForm.quantity" :min="0" /></ElFormItem
          ><ElFormItem label="修正原因"><ElInput v-model="stockForm.reason" /></ElFormItem
          ><ElButton :loading="saving" @click="adjustStock">记录盘点修正</ElButton></ElForm
        ></ElTabPane
      >
      <ElTabPane v-if="form.id" label="状态与核对" name="state"
        ><p>当前状态：{{ form.study_state || '待启用' }}</p
        ><ElForm label-position="top" :disabled="saving"
          ><ElFormItem label="新状态"
            ><ElSelect v-model="state"
              ><ElOption
                v-for="s in states"
                :key="s"
                :label="s"
                :value="s" /></ElSelect></ElFormItem
          ><ElFormItem label="生效日期"
            ><ElDatePicker v-model="effectiveDate" value-format="YYYY-MM-DD" /></ElFormItem
          ><ElFormItem label="变更原因/核对记录"><ElInput v-model="stateReason" /></ElFormItem
          ><ElButton type="primary" :loading="saving" @click="saveState">登记状态变更</ElButton
          ><div class="toolbar"
            ><ElCheckbox v-model="form.identity_confirmed">患者已核对基础信息</ElCheckbox
            ><ElCheckbox v-model="form.medicine_confirmed">患者已核对药品</ElCheckbox
            ><ElButton :loading="saving" @click="saveConfirmations">记录核对</ElButton></div
          ></ElForm
        ></ElTabPane
      >
      <ElTabPane v-if="form.id" label="操作记录" name="history"
        ><ElTable :data="history"
          ><ElTableColumn prop="time" label="时间" /><ElTableColumn
            prop="operator"
            label="操作人" /><ElTableColumn prop="action" label="操作" /><ElTableColumn
            prop="reason"
            label="原因" /></ElTable></ElTabPane></ElTabs
  ></ElDialog>
</template>
<script setup lang="ts">
  import { ref } from 'vue'
  import request from '@/utils/http'
  import { ElMessage } from 'element-plus'
  import {
    fetchProjectList,
    fetchProjectDetail,
    fetchGroupDetail,
    type GroupRecord,
    type ProjectRecord,
    type Drug
  } from '@/api/project'
  interface Patient {
    id?: number
    revision?: number
    name: string
    mobile: string
    gender: number
    age: number
    hospital_name: string
    department_name: string
    project_id?: number
    group_id?: number
    owner_id?: number
    enroll_date: string
    consent_date: string
    offline_confirmed: boolean
    consent_confirmed: boolean
    identity_confirmed: boolean
    medicine_confirmed: boolean
    study_state?: string
    reason: string
  }
  interface DispenseItem {
    drug_id: number
    name: string
    unit: string
    quantity: number
  }
  interface Treatment {
    id?: number
    start_date: string
    end_date?: string
    treatment_days: number
    reason: string
    drugs: (Omit<Drug, 'dose'> & { dose: string | number })[]
    created_at?: string
  }
  interface Management {
    patient: Patient
    treatments: Treatment[]
    dispensings: { issued_date: string; items: DispenseItem[]; operator: string; reason: string }[]
    history: { time: string; operator: string; action: string; reason: string }[]
  }
  const stock = ref<
    {
      drug_id: number
      name: string
      unit: string
      estimated: number
      days: number
      needs_pickup: boolean
    }[]
  >([])
  const stockForm = ref({
    drug_id: undefined as number | undefined,
    date: '',
    quantity: 0,
    reason: ''
  })
  async function loadStock() {
    stock.value = await request.get({
      url: '/app/core/patient/stock',
      params: { user_id: form.value.id }
    })
  }
  async function adjustStock() {
    await action('patient/stock-adjust', { user_id: form.value.id, ...stockForm.value })
    await loadStock()
  }
  const blank = (): Patient => ({
    name: '',
    mobile: '',
    gender: 1,
    age: 30,
    hospital_name: '',
    department_name: '',
    enroll_date: '',
    consent_date: '',
    offline_confirmed: false,
    consent_confirmed: false,
    identity_confirmed: false,
    medicine_confirmed: false,
    reason: ''
  })
  const emit = defineEmits<{ saved: [] }>(),
    visible = ref(false),
    saving = ref(false),
    tab = ref('base'),
    form = ref(blank()),
    originalProject = ref<number>(),
    projects = ref<ProjectRecord[]>([]),
    groups = ref<GroupRecord[]>([]),
    owners = ref<{ id: number; realname: string; username: string; status: number }[]>([]),
    treatments = ref<Treatment[]>([]),
    dispensings = ref<Management['dispensings']>([]),
    history = ref<Management['history']>([])
  const treatment = ref<Treatment>({ start_date: '', treatment_days: 30, reason: '', drugs: [] }),
    dispense = ref({ issued_date: '', reason: '', items: [] as DispenseItem[] }),
    states = ['待启用', '治疗中', '暂停用药', '已完成', '提前退出', '失访'],
    state = ref('治疗中'),
    effectiveDate = ref(''),
    stateReason = ref('')
  async function loadGroups() {
    groups.value = form.value.project_id
      ? (await fetchProjectDetail(form.value.project_id)).groups || []
      : []
    if (!originalProject.value) form.value.group_id = undefined
  }
  async function refresh() {
    const data = await request.get<Management>({
      url: '/app/core/patient/management',
      params: { user_id: form.value.id }
    })
    form.value = { ...blank(), ...data.patient, reason: '' }
    await loadStock()
    treatments.value = data.treatments
    dispensings.value = data.dispensings
    history.value = data.history
    const last = data.treatments.at(-1)
    dispense.value = {
      issued_date: '',
      reason: '',
      items:
        last?.drugs.map((d) => ({ drug_id: d.drug_id, name: d.name, unit: d.unit, quantity: 0 })) ||
        []
    }
  }
  async function open(id?: number) {
    form.value = blank()
    stock.value = []
    stockForm.value = { drug_id: undefined, date: '', quantity: 0, reason: '' }
    tab.value = 'base'
    originalProject.value = undefined
    treatment.value = { start_date: '', treatment_days: 30, reason: '', drugs: [] }
    stateReason.value = ''
    effectiveDate.value = ''
    if (id) {
      form.value.id = id
      await refresh()
      originalProject.value = form.value.project_id
    }
    const all: ProjectRecord[] = []
    let current = 1
    while (true) {
      const p = await fetchProjectList({ current: current++, size: 100 })
      all.push(...p.list)
      if (all.length >= p.total) break
    }
    projects.value = all
    owners.value = await request.get({ url: '/app/core/admin/index' })
    await loadGroups()
    visible.value = true
  }
  async function action(url: string, params: unknown) {
    saving.value = true
    try {
      await request.post({ url: '/app/core/' + url, params, showSuccessMessage: true })
      await refresh()
      emit('saved')
    } finally {
      saving.value = false
    }
  }
  async function saveBase() {
    saving.value = true
    try {
      const p = await request.post<Patient>({
        url: '/app/core/patient/save',
        params: form.value,
        showSuccessMessage: true
      })
      form.value.id = p.id
      originalProject.value = p.project_id
      await refresh()
      emit('saved')
    } finally {
      saving.value = false
    }
  }
  async function fromGroup() {
    if (!form.value.project_id || !form.value.group_id) {
      ElMessage.warning('请先保存研究项目和分组')
      return
    }
    const g = await fetchGroupDetail(form.value.project_id, form.value.group_id)
    if (!g.medication) {
      ElMessage.warning('分组尚未配置用药方案')
      return
    }
    treatment.value = {
      start_date: '',
      treatment_days: g.medication.treatment_days,
      reason: '',
      drugs: JSON.parse(JSON.stringify(g.medication.snapshot.drugs || []))
    }
  }
  const saveTreatment = () =>
    action('patient/treatment', { user_id: form.value.id, ...treatment.value })
  const saveDispense = () =>
    action('patient/dispense', { user_id: form.value.id, ...dispense.value })
  const saveState = () =>
    action('patient/state', {
      user_id: form.value.id,
      state: state.value,
      effective_date: effectiveDate.value,
      reason: stateReason.value
    })
  const saveConfirmations = () =>
    action('patient/confirmations', {
      user_id: form.value.id,
      identity_confirmed: form.value.identity_confirmed,
      medicine_confirmed: form.value.medicine_confirmed,
      reason: stateReason.value
    })
  function close(done: () => void) {
    if (!saving.value) done()
  }
  defineExpose({ open })
</script>
<style scoped>
  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 16px;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    margin: 16px 0;
  }
  .drug {
    border: 1px solid var(--el-border-color);
    padding: 16px;
    margin: 16px 0;
  }
  .el-select {
    width: 100%;
  }
  @media (max-width: 700px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
