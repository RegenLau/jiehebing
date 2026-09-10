<template>
  <div class="patient-management-page">
    <div class="page-heading">
      <div>
        <h2>{{ form.id ? '患者研究管理' : '新增患者与安排' }}</h2>
        <p v-if="form.id">
          {{ form.name || '-' }} · {{ form.patient_code || '-' }} · {{ form.project_name || '-' }} /
          {{ form.group_name || '-' }}
        </p>
        <p v-else>一次完成患者资料、研究分组、个人用药方案和可选的首次发药登记。</p>
      </div>
      <div class="page-actions">
        <ElButton @click="goBack">返回患者列表</ElButton>
        <ElButton v-if="form.id" :loading="loading" @click="loadPage">刷新</ElButton>
      </div>
    </div>

    <ElCard v-if="!form.id" v-loading="loading" shadow="never" class="onboarding-card">
      <ElSteps :active="createStep" finish-status="success" align-center>
        <ElStep title="基本信息" description="姓名与登录手机号" />
        <ElStep title="研究分组" description="归属与线下确认" />
        <ElStep title="用药与发药" description="核对个人安排" />
      </ElSteps>

      <section v-show="createStep === 0" class="step-content">
        <div class="section-heading">
          <div><h3>患者基本信息</h3><p>手机号是患者端登录凭证，保存前请与患者核对。</p></div>
        </div>
        <ElForm label-position="top" :disabled="saving">
          <div class="form-grid two-columns">
            <ElFormItem label="姓名" required
              ><ElInput v-model.trim="form.name" maxlength="60"
            /></ElFormItem>
            <ElFormItem label="手机号" required>
              <ElInput v-model.trim="form.mobile" maxlength="11" placeholder="11 位手机号" />
            </ElFormItem>
            <ElFormItem label="性别" required>
              <ElSelect v-model="form.gender" placeholder="请选择">
                <ElOption label="男" :value="1" />
                <ElOption label="女" :value="2" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="出生日期" required>
              <ElDatePicker
                v-model="form.birth_date"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择出生年月日"
                :disabled-date="disableFutureDate"
              />
            </ElFormItem>
          </div>
        </ElForm>
      </section>

      <section v-show="createStep === 1" class="step-content">
        <div class="section-heading">
          <div><h3>研究与分组</h3><p>选择分组后，系统会带入该组的用药和随访安排。</p></div>
        </div>
        <ElForm label-position="top" :disabled="saving">
          <div class="form-grid two-columns">
            <ElFormItem label="研究项目" required>
              <ElSelect v-model="form.project_id" filterable @change="changeProject">
                <ElOption
                  v-for="project in projects"
                  :key="project.id"
                  :label="project.name"
                  :value="project.id"
                />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="研究分组" required>
              <ElSelect v-model="form.group_id" filterable @change="selectGroup">
                <ElOption
                  v-for="group in groups"
                  :key="group.id"
                  :label="group.name"
                  :value="group.id!"
                />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="负责人员" required>
              <ElSelect v-model="form.owner_id" filterable>
                <ElOption
                  v-for="owner in owners"
                  :key="owner.id"
                  :label="owner.realname || owner.username"
                  :value="owner.id"
                  :disabled="owner.status !== 1"
                />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="入组日期" required>
              <ElDatePicker v-model="form.enroll_date" type="date" value-format="YYYY-MM-DD" />
            </ElFormItem>
          </div>
          <div class="confirmation-box">
            <ElCheckbox v-model="form.offline_confirmed">已在线下确认符合研究入组条件</ElCheckbox>
            <ElCheckbox v-model="form.consent_confirmed">已登记知情同意</ElCheckbox>
          </div>
        </ElForm>
      </section>

      <section v-show="createStep === 2" class="step-content">
        <div class="section-heading">
          <div
            ><h3>用药与安排核对</h3><p>默认采用分组方案；确有差异时，再为当前患者单独调整。</p></div
          >
          <ElTag v-if="groupRecord?.medication" type="info">
            来源：{{ groupRecord.medication.snapshot.name }}
          </ElTag>
        </div>
        <MedicationEditor
          v-model:treatment="treatment"
          v-model:adjusted="personalAdjustment"
          :group="groupRecord"
          :disabled="saving"
          @reset="resetToGroup"
        />
        <ElDivider />
        <ElCheckbox v-model="registerInitialDispense" class="dispense-switch">
          已完成首次发药，同时登记实际数量
        </ElCheckbox>
        <div v-if="registerInitialDispense" class="dispense-panel">
          <ElForm label-position="top" :disabled="saving">
            <div class="form-grid two-columns">
              <ElFormItem label="实际发药日期" required>
                <ElDatePicker
                  v-model="dispense.issued_date"
                  value-format="YYYY-MM-DD"
                  :disabled-date="disableFutureDate"
                />
              </ElFormItem>
              <ElFormItem label="发药说明" required>
                <ElInput v-model.trim="dispense.reason" maxlength="500" />
              </ElFormItem>
            </div>
            <div class="dispense-items">
              <div v-for="item in activeDispenseItems" :key="item.drug_id" class="dispense-row">
                <span>{{ item.name }}（{{ item.unit }}）</span>
                <ElInputNumber v-model="item.quantity" :min="0" :precision="3" />
              </div>
            </div>
          </ElForm>
        </div>
      </section>

      <div class="step-actions">
        <ElButton v-if="createStep > 0" :disabled="saving" @click="createStep--">上一步</ElButton>
        <ElButton v-if="createStep < 2" type="primary" @click="nextStep">下一步</ElButton>
        <ElButton v-else type="primary" :loading="saving" @click="saveOnboarding">
          保存患者与安排
        </ElButton>
      </div>
    </ElCard>

    <template v-else>
      <ElCard v-loading="loading" shadow="never" class="profile-card">
        <div class="section-heading">
          <div><h3>基本信息与研究归属</h3><p>常用查看保持摘要展示，需要修改时再展开。</p></div>
          <ElButton v-if="!editingBase" @click="editingBase = true">编辑基本信息</ElButton>
        </div>
        <ElDescriptions v-if="!editingBase" :column="4" border>
          <ElDescriptionsItem label="姓名">{{ form.name }}</ElDescriptionsItem>
          <ElDescriptionsItem label="患者编号">{{ form.patient_code }}</ElDescriptionsItem>
          <ElDescriptionsItem label="手机号">{{ form.mobile }}</ElDescriptionsItem>
          <ElDescriptionsItem label="性别 / 出生日期"
            >{{ form.gender_text }} / {{ form.birth_date }}</ElDescriptionsItem
          >
          <ElDescriptionsItem label="研究项目" :span="2">{{
            form.project_name
          }}</ElDescriptionsItem>
          <ElDescriptionsItem label="研究分组">{{ form.group_name }}</ElDescriptionsItem>
          <ElDescriptionsItem label="入组日期">{{ form.enroll_date }}</ElDescriptionsItem>
          <ElDescriptionsItem label="负责人员">{{ form.owner_name || '-' }}</ElDescriptionsItem>
          <ElDescriptionsItem label="患者端登录">
            <ElTag :type="form.login_enabled ? 'success' : 'info'">{{
              form.login_enabled ? '可登录' : '不可登录'
            }}</ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="基础信息核对">{{
            form.identity_confirmed ? '已核对' : '待患者核对'
          }}</ElDescriptionsItem>
          <ElDescriptionsItem label="用药核对">{{
            form.medicine_confirmed ? '已核对' : '待患者核对'
          }}</ElDescriptionsItem>
        </ElDescriptions>
        <ElForm v-else label-position="top" :disabled="saving">
          <div class="form-grid three-columns">
            <ElFormItem label="姓名" required
              ><ElInput v-model.trim="form.name" maxlength="60"
            /></ElFormItem>
            <ElFormItem label="手机号" required
              ><ElInput v-model.trim="form.mobile" maxlength="11"
            /></ElFormItem>
            <ElFormItem label="性别" required>
              <ElSelect v-model="form.gender"
                ><ElOption label="男" :value="1" /><ElOption label="女" :value="2"
              /></ElSelect>
            </ElFormItem>
            <ElFormItem label="出生日期" required>
              <ElDatePicker
                v-model="form.birth_date"
                value-format="YYYY-MM-DD"
                :disabled-date="disableFutureDate"
              />
            </ElFormItem>
            <ElFormItem label="负责人员" required>
              <ElSelect v-model="form.owner_id" filterable>
                <ElOption
                  v-for="owner in owners"
                  :key="owner.id"
                  :label="owner.realname || owner.username"
                  :value="owner.id"
                  :disabled="owner.status !== 1"
                />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="修改说明" required
              ><ElInput v-model.trim="form.reason" maxlength="300"
            /></ElFormItem>
          </div>
          <div class="inline-actions">
            <ElButton @click="cancelBaseEdit">取消</ElButton>
            <ElButton type="primary" :loading="saving" @click="saveBase">保存基本信息</ElButton>
          </div>
        </ElForm>
      </ElCard>

      <ElCard v-loading="loading" shadow="never">
        <ElTabs v-model="tab" class="management-tabs">
          <ElTabPane label="个人用药" name="treatment">
            <div class="tab-heading">
              <div>
                <h3>个人用药方案</h3>
                <p>方案保存后只影响当前患者未来的用药计划，同组患者和分组模板保持不变。</p>
              </div>
              <ElTag
                v-if="latestTreatment"
                :type="latestTreatment.adjusted ? 'warning' : 'success'"
              >
                {{ latestTreatment.adjusted ? '个体调整' : '采用分组方案' }}
              </ElTag>
            </div>
            <MedicationEditor
              v-model:treatment="treatment"
              v-model:adjusted="personalAdjustment"
              :group="groupRecord"
              :disabled="saving"
              @reset="resetToGroup"
            />
            <ElButton type="primary" :loading="saving" @click="saveTreatment"
              >保存个人用药方案</ElButton
            >
            <h3 class="history-title">方案历史</h3>
            <ElTable :data="[...treatments].reverse()" border empty-text="尚未确认个人用药方案">
              <ElTableColumn prop="created_at" label="记录时间" min-width="170" />
              <ElTableColumn label="来源" width="110">
                <template #default="{ row }">
                  <ElTag :type="row.adjusted ? 'warning' : 'success'">{{
                    row.adjusted ? '个体调整' : '分组方案'
                  }}</ElTag>
                </template>
              </ElTableColumn>
              <ElTableColumn prop="start_date" label="开始" width="115" />
              <ElTableColumn prop="end_date" label="结束" width="115" />
              <ElTableColumn label="调整内容" min-width="220">
                <template #default="{ row }">{{
                  row.adjustment_summary?.join('；') || '无个体差异'
                }}</template>
              </ElTableColumn>
              <ElTableColumn prop="reason" label="原因" min-width="160" />
            </ElTable>
          </ElTabPane>

          <ElTabPane label="实际发药" name="dispense">
            <ElAlert
              title="这里登记患者实际拿到的药量，与分组中的默认首次发药数量分开保存。"
              type="info"
              :closable="false"
              show-icon
            />
            <ElForm label-position="top" :disabled="saving" class="tab-form">
              <div class="form-grid two-columns">
                <ElFormItem label="实际发药日期" required>
                  <ElDatePicker
                    v-model="dispense.issued_date"
                    value-format="YYYY-MM-DD"
                    :disabled-date="disableFutureDate"
                  />
                </ElFormItem>
                <ElFormItem label="发药说明" required
                  ><ElInput v-model.trim="dispense.reason" maxlength="500"
                /></ElFormItem>
              </div>
              <div class="dispense-items">
                <div v-for="item in dispense.items" :key="item.drug_id" class="dispense-row">
                  <span>{{ item.name }}（{{ item.unit }}）</span>
                  <ElInputNumber v-model="item.quantity" :min="0" :precision="3" />
                </div>
              </div>
            </ElForm>
            <ElButton type="primary" :loading="saving" @click="saveDispense">登记实际发药</ElButton>
            <h3 class="history-title">发药记录</h3>
            <ElTable :data="[...dispensings].reverse()" border empty-text="暂无发药记录">
              <ElTableColumn prop="issued_date" label="实际日期" width="120" />
              <ElTableColumn label="药品与数量" min-width="260">
                <template #default="{ row }">{{ formatDispense(row.items) }}</template>
              </ElTableColumn>
              <ElTableColumn prop="operator" label="操作人" min-width="120" />
              <ElTableColumn prop="reason" label="说明" min-width="160" />
            </ElTable>
          </ElTabPane>

          <ElTabPane label="预计余药" name="stock">
            <ElAlert
              title="按患者实际发药或最近盘点，扣除截至昨日的计划用量估算；没有实际药量时不生成取药提醒。"
              type="warning"
              :closable="false"
              show-icon
            />
            <div class="inline-actions tab-form"
              ><ElButton @click="loadStock">刷新余药</ElButton></div
            >
            <ElTable :data="stock" border empty-text="请先确认个人用药方案并登记实际发药">
              <ElTableColumn prop="name" label="药品" min-width="150" />
              <ElTableColumn label="预计余量" min-width="120"
                ><template #default="{ row }">{{
                  row.calculation_ready ? `${row.estimated} ${row.unit}` : '-'
                }}</template></ElTableColumn
              >
              <ElTableColumn label="预计可用" min-width="110"
                ><template #default="{ row }">{{
                  row.calculation_ready ? `${row.days} 天` : '-'
                }}</template></ElTableColumn
              >
              <ElTableColumn label="提醒日 / 预计不足日" min-width="200"
                ><template #default="{ row }">
                  <template v-if="row.calculation_ready">
                    {{ row.reminder_date }} / {{ row.expected_shortage_date }}
                  </template>
                  <template v-else>待登记实际发药或盘点</template>
                </template></ElTableColumn
              >
              <ElTableColumn label="取药提醒" min-width="140"
                ><template #default="{ row }"
                  ><ElTag
                    :type="
                      !row.calculation_ready ? 'warning' : row.needs_pickup ? 'danger' : 'success'
                    "
                    >{{
                      !row.calculation_ready
                        ? '待登记实际药量'
                        : row.needs_pickup
                          ? '需联系取药'
                          : '暂未到提醒窗口'
                    }}</ElTag
                  ></template
                ></ElTableColumn
              >
            </ElTable>
            <ElForm label-position="top" :disabled="saving" class="stock-form">
              <h3>记录实际盘点</h3>
              <div class="form-grid three-columns">
                <ElFormItem label="盘点药品" required>
                  <ElSelect v-model="stockForm.drug_id">
                    <ElOption
                      v-for="drug in stock"
                      :key="drug.drug_id"
                      :label="drug.name"
                      :value="drug.drug_id"
                    />
                  </ElSelect>
                </ElFormItem>
                <ElFormItem label="日终盘点日期" required>
                  <ElDatePicker v-model="stockForm.date" value-format="YYYY-MM-DD" />
                </ElFormItem>
                <ElFormItem label="日终实际余量" required
                  ><ElInputNumber v-model="stockForm.quantity" :min="0"
                /></ElFormItem>
              </div>
              <ElFormItem label="修正原因" required
                ><ElInput v-model.trim="stockForm.reason" maxlength="500"
              /></ElFormItem>
              <ElButton :loading="saving" @click="adjustStock">记录盘点修正</ElButton>
            </ElForm>
          </ElTabPane>

          <ElTabPane label="状态与核对" name="state">
            <div class="status-summary"
              >当前研究状态：<ElTag>{{ form.study_state || '待启用' }}</ElTag></div
            >
            <ElForm label-position="top" :disabled="saving" class="tab-form">
              <div class="form-grid three-columns">
                <ElFormItem label="新状态" required>
                  <ElSelect v-model="state"
                    ><ElOption v-for="item in states" :key="item" :label="item" :value="item"
                  /></ElSelect>
                </ElFormItem>
                <ElFormItem label="生效日期" required
                  ><ElDatePicker v-model="effectiveDate" value-format="YYYY-MM-DD"
                /></ElFormItem>
                <ElFormItem label="变更原因" required
                  ><ElInput v-model.trim="stateReason" maxlength="500"
                /></ElFormItem>
              </div>
              <ElButton type="primary" :loading="saving" @click="saveState">登记状态变更</ElButton>
            </ElForm>
          </ElTabPane>

          <ElTabPane label="患者端确认" name="confirmation">
            <div class="tab-heading">
              <div>
                <h3>患者端确认</h3>
                <p>确认结果由患者本人提交；医生修改资料或用药安排后会自动要求重新确认。</p>
              </div>
            </div>
            <div class="confirmation-box confirmation-status">
              <span>基础信息</span>
              <ElTag :type="form.identity_confirmed ? 'success' : 'warning'">{{
                form.identity_confirmed ? '患者已确认' : '待患者确认'
              }}</ElTag>
              <span>当前用药</span>
              <ElTag :type="form.medicine_confirmed ? 'success' : 'warning'">{{
                form.medicine_confirmed ? '患者已确认' : '待患者确认'
              }}</ElTag>
            </div>
            <ElTable
              :data="confirmationIssues"
              border
              empty-text="暂无患者反馈"
              class="issue-table"
            >
              <ElTableColumn prop="created_at" label="提交时间" min-width="170" />
              <ElTableColumn prop="type_text" label="反馈类型" min-width="140" />
              <ElTableColumn prop="note" label="患者说明" min-width="220" />
              <ElTableColumn prop="status" label="处理状态" width="110" />
            </ElTable>
          </ElTabPane>

          <ElTabPane label="操作记录" name="history">
            <ElTable :data="history" border empty-text="暂无操作记录">
              <ElTableColumn prop="time" label="时间" min-width="170" />
              <ElTableColumn prop="operator" label="操作人" min-width="120" />
              <ElTableColumn prop="action" label="操作" min-width="130" />
              <ElTableColumn prop="reason" label="原因" min-width="180" />
            </ElTable>
          </ElTabPane>
        </ElTabs>
      </ElCard>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import request from '@/utils/http'
  import { ElMessage } from 'element-plus'
  import { useRoute, useRouter } from 'vue-router'
  import {
    fetchProjectDetail,
    fetchProjectList,
    type Drug,
    type GroupRecord,
    type ProjectRecord
  } from '@/api/project'
  import MedicationEditor from './medication-editor.vue'

  interface Patient {
    id?: number
    revision?: number
    patient_code?: string
    name: string
    mobile: string
    gender?: number
    gender_text?: string
    birth_date: string
    project_id?: number
    project_name?: string
    group_id?: number
    group_name?: string
    medication_scheme_id?: number
    medication_scheme_name?: string
    owner_id?: number
    owner_name?: string
    enroll_date: string
    offline_confirmed: boolean
    consent_confirmed: boolean
    identity_confirmed: boolean
    medicine_confirmed: boolean
    login_enabled?: boolean
    study_state?: string
    reason: string
  }
  interface TreatmentDrug extends Omit<Drug, 'dose' | 'times'> {
    dose: string | number
    times: string
    enabled: boolean
  }
  interface Treatment {
    id?: number
    start_date: string
    end_date?: string
    treatment_days: number
    reason: string
    adjusted?: boolean
    adjustment_summary?: string[]
    drugs: TreatmentDrug[]
    created_at?: string
  }
  interface DispenseItem {
    drug_id: number
    name: string
    unit: string
    quantity: number
  }
  interface Management {
    patient: Patient
    treatments: Treatment[]
    dispensings: { issued_date: string; items: DispenseItem[]; operator: string; reason: string }[]
    confirmation_issues: { created_at: string; type_text: string; note: string; status: string }[]
    history: { time: string; operator: string; action: string; reason: string }[]
  }

  const route = useRoute()
  const router = useRouter()
  const todayText = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
  const blank = (): Patient => ({
    name: '',
    mobile: '',
    gender: undefined,
    birth_date: '',
    enroll_date: todayText(),
    offline_confirmed: false,
    consent_confirmed: false,
    identity_confirmed: false,
    medicine_confirmed: false,
    reason: ''
  })
  const blankTreatment = (): Treatment => ({
    start_date: todayText(),
    treatment_days: 30,
    reason: '首次确认采用分组方案',
    drugs: []
  })
  const userId = computed(() => {
    const value = route.query.user_id
    return typeof value === 'string' && Number.isSafeInteger(Number(value)) ? Number(value) : 0
  })
  const loading = ref(false)
  const saving = ref(false)
  const createStep = ref(0)
  const editingBase = ref(false)
  const tab = ref('treatment')
  const form = ref<Patient>(blank())
  const projects = ref<ProjectRecord[]>([])
  const groups = ref<GroupRecord[]>([])
  const groupRecord = ref<GroupRecord | null>(null)
  const owners = ref<{ id: number; realname: string; username: string; status: number }[]>([])
  const treatment = ref<Treatment>(blankTreatment())
  const confirmationIssues = ref<Management['confirmation_issues']>([])
  const personalAdjustment = ref(false)
  const treatments = ref<Treatment[]>([])
  const dispensings = ref<Management['dispensings']>([])
  const history = ref<Management['history']>([])
  const registerInitialDispense = ref(false)
  const dispense = ref({
    issued_date: todayText(),
    reason: '首次发药',
    items: [] as DispenseItem[]
  })
  const states = ['待启用', '治疗中', '暂停用药', '已完成', '提前退出', '失访']
  const state = ref('治疗中')
  const effectiveDate = ref(todayText())
  const stateReason = ref('')
  const stock = ref<
    {
      drug_id: number
      name: string
      unit: string
      estimated: number
      days: number
      needs_pickup: boolean
      calculation_ready: boolean
      reminder_date: string
      expected_shortage_date: string
    }[]
  >([])
  const stockForm = ref({
    drug_id: undefined as number | undefined,
    date: '',
    quantity: 0,
    reason: ''
  })
  const latestTreatment = computed(() => treatments.value.at(-1))
  const activeDispenseItems = computed(() =>
    dispense.value.items.filter((item) =>
      treatment.value.drugs.some((drug) => drug.drug_id === item.drug_id && drug.enabled)
    )
  )

  const editableDrug = (drug: Drug, enabled = true): TreatmentDrug => ({
    ...JSON.parse(JSON.stringify(drug)),
    dose: drug.dose,
    times: Array.isArray(drug.times) ? drug.times.join(',') : String(drug.times || ''),
    enabled
  })
  const applyGroupTreatment = (preserveStart = true) => {
    const medication = groupRecord.value?.medication
    if (!medication) {
      treatment.value = blankTreatment()
      dispense.value.items = []
      return
    }
    const startDate = preserveStart ? treatment.value.start_date || todayText() : todayText()
    treatment.value = {
      start_date: startDate,
      treatment_days: medication.treatment_days,
      reason: '首次确认采用分组方案',
      drugs: (medication.snapshot.drugs || []).map((drug) => editableDrug(drug))
    }
    personalAdjustment.value = false
    dispense.value.items = treatment.value.drugs.map((drug) => ({
      drug_id: drug.drug_id,
      name: drug.name,
      unit: drug.unit,
      quantity: medication.quantities.find((item) => item.drug_id === drug.drug_id)?.quantity || 0
    }))
  }
  const applyLatestTreatment = () => {
    const latest = latestTreatment.value
    const sources = groupRecord.value?.medication?.snapshot.drugs || []
    if (!latest) {
      applyGroupTreatment(false)
      return
    }
    const current = latest.drugs || []
    treatment.value = {
      ...latest,
      start_date: todayText(),
      reason: '',
      drugs: sources.map((source) => {
        const personal = current.find((item) => item.drug_id === source.drug_id)
        return editableDrug((personal || source) as Drug, Boolean(personal))
      })
    }
    personalAdjustment.value = Boolean(latest.adjusted)
    dispense.value = {
      issued_date: todayText(),
      reason: '',
      items: current.map((drug) => ({
        drug_id: drug.drug_id,
        name: drug.name,
        unit: drug.unit,
        quantity: 0
      }))
    }
  }
  const resetToGroup = () => applyGroupTreatment(true)

  async function loadProjects() {
    const all: ProjectRecord[] = []
    let current = 1
    while (true) {
      const page = await fetchProjectList({ current: current++, size: 100 })
      all.push(...page.list)
      if (all.length >= page.total) break
    }
    projects.value = all
  }
  async function loadGroups(reset = true) {
    groups.value = form.value.project_id
      ? (await fetchProjectDetail(form.value.project_id)).groups || []
      : []
    if (reset) {
      form.value.group_id = undefined
      groupRecord.value = null
      treatment.value = blankTreatment()
    }
  }
  async function changeProject() {
    await loadGroups(true)
  }
  async function selectGroup() {
    const selected = groups.value.find((item) => item.id === form.value.group_id) || null
    groupRecord.value = selected
    if (!selected?.medication) {
      treatment.value = blankTreatment()
      ElMessage.warning('该分组尚未配置用药方案，请先完成分组配置')
      return
    }
    applyGroupTreatment(false)
  }
  async function refreshManagement() {
    const data = await request.get<Management>({
      url: '/app/core/patient/management',
      params: { user_id: form.value.id }
    })
    form.value = { ...blank(), ...data.patient, reason: '' }
    treatments.value = data.treatments
    dispensings.value = data.dispensings
    history.value = data.history
    confirmationIssues.value = data.confirmation_issues || []
    await loadGroups(false)
    groupRecord.value = groups.value.find((item) => item.id === form.value.group_id) || null
    applyLatestTreatment()
    await loadStock()
  }
  async function loadPage() {
    loading.value = true
    try {
      form.value = blank()
      createStep.value = 0
      editingBase.value = false
      treatments.value = []
      dispensings.value = []
      history.value = []
      confirmationIssues.value = []
      stock.value = []
      treatment.value = blankTreatment()
      await Promise.all([
        loadProjects(),
        request
          .get<{ id: number; realname: string; username: string; status: number }[]>({
            url: '/app/core/admin/index'
          })
          .then((data) => {
            owners.value = data
          })
      ])
      if (userId.value) {
        form.value.id = userId.value
        await refreshManagement()
      } else {
        form.value.owner_id = owners.value.find((owner) => owner.status === 1)?.id
        const routeProject = Number(route.query.project_id)
        const routeGroup = Number(route.query.group_id)
        if (Number.isSafeInteger(routeProject) && routeProject > 0) {
          form.value.project_id = routeProject
          await loadGroups(false)
          if (
            Number.isSafeInteger(routeGroup) &&
            groups.value.some((group) => group.id === routeGroup)
          ) {
            form.value.group_id = routeGroup
            await selectGroup()
          }
        }
      }
    } finally {
      loading.value = false
    }
  }
  function nextStep() {
    if (createStep.value === 0) {
      if (
        !form.value.name ||
        !/^1\d{10}$/.test(form.value.mobile) ||
        !form.value.gender ||
        !form.value.birth_date
      ) {
        ElMessage.warning('请完整填写姓名、11 位手机号、性别和出生日期')
        return
      }
    }
    if (createStep.value === 1) {
      if (
        !form.value.project_id ||
        !form.value.group_id ||
        !form.value.owner_id ||
        !form.value.enroll_date
      ) {
        ElMessage.warning('请完整选择研究项目、分组、负责人员和入组日期')
        return
      }
      if (!form.value.offline_confirmed || !form.value.consent_confirmed) {
        ElMessage.warning('请确认线下入组和知情同意均已登记')
        return
      }
      if (!groupRecord.value?.medication) {
        ElMessage.warning('所选分组尚未配置用药方案')
        return
      }
    }
    createStep.value++
  }
  const treatmentPayload = () => ({
    start_date: treatment.value.start_date,
    treatment_days: treatment.value.treatment_days,
    reason: treatment.value.reason,
    adjusted: personalAdjustment.value,
    drugs: personalAdjustment.value
      ? treatment.value.drugs
          .filter((drug) => drug.enabled)
          .map((drug) => ({
            drug_id: drug.drug_id,
            name: drug.name,
            specification: drug.specification,
            dose: drug.dose,
            unit: drug.unit,
            frequency: drug.frequency,
            times: drug.times,
            precautions: drug.precautions
          }))
      : undefined
  })
  function validateTreatment() {
    if (!treatment.value.start_date || !treatment.value.reason.trim()) {
      ElMessage.warning(
        personalAdjustment.value ? '请填写开始日期和个体调整原因' : '请填写开始日期和方案确认说明'
      )
      return false
    }
    const active = treatment.value.drugs.filter((drug) => drug.enabled)
    if (!active.length) {
      ElMessage.warning('个人用药方案至少保留一种药品')
      return false
    }
    if (active.some((drug) => Number(drug.dose) <= 0 || !drug.times.trim())) {
      ElMessage.warning('请填写有效的单次用量和服药时间')
      return false
    }
    return true
  }
  async function saveOnboarding() {
    if (!validateTreatment()) return
    if (
      registerInitialDispense.value &&
      (!dispense.value.issued_date ||
        !dispense.value.reason.trim() ||
        activeDispenseItems.value.some((item) => item.quantity <= 0))
    ) {
      ElMessage.warning('请完整填写首次发药日期、数量和说明')
      return
    }
    saving.value = true
    try {
      const result = await request.post<{ patient: Patient }>({
        url: '/app/core/patient/onboard',
        params: {
          patient: form.value,
          treatment: treatmentPayload(),
          dispense: registerInitialDispense.value
            ? { ...dispense.value, items: activeDispenseItems.value }
            : null
        },
        showSuccessMessage: true
      })
      await router.replace({
        path: '/patient/management',
        query: { user_id: String(result.patient.id) }
      })
    } finally {
      saving.value = false
    }
  }
  async function saveBase() {
    saving.value = true
    try {
      await request.post({
        url: '/app/core/patient/save',
        params: form.value,
        showSuccessMessage: true
      })
      editingBase.value = false
      await refreshManagement()
    } finally {
      saving.value = false
    }
  }
  function cancelBaseEdit() {
    editingBase.value = false
    void refreshManagement()
  }
  async function action(url: string, params: unknown) {
    saving.value = true
    try {
      await request.post({ url: '/app/core/' + url, params, showSuccessMessage: true })
      await refreshManagement()
    } finally {
      saving.value = false
    }
  }
  async function saveTreatment() {
    if (!validateTreatment()) return
    await action('patient/treatment', { user_id: form.value.id, ...treatmentPayload() })
  }
  async function saveDispense() {
    if (
      !dispense.value.issued_date ||
      !dispense.value.reason.trim() ||
      dispense.value.items.some((item) => item.quantity <= 0)
    ) {
      ElMessage.warning('请完整填写发药日期、数量和说明')
      return
    }
    await action('patient/dispense', { user_id: form.value.id, ...dispense.value })
  }
  async function loadStock() {
    if (!form.value.id) return
    stock.value = await request.get({
      url: '/app/core/patient/stock',
      params: { user_id: form.value.id }
    })
  }
  async function adjustStock() {
    await action('patient/stock-adjust', { user_id: form.value.id, ...stockForm.value })
    await loadStock()
  }
  const saveState = () =>
    action('patient/state', {
      user_id: form.value.id,
      state: state.value,
      effective_date: effectiveDate.value,
      reason: stateReason.value
    })
  const formatDispense = (items: DispenseItem[]) =>
    items.map((item) => `${item.name} ${item.quantity}${item.unit}`).join('、')
  const goBack = () => router.push('/patient/index')
  const disableFutureDate = (date: Date) => date.getTime() > Date.now()

  watch(userId, () => void loadPage(), { immediate: true })
</script>

<style scoped>
  .patient-management-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .page-heading,
  .section-heading,
  .tab-heading,
  .adjustment-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .page-heading h2,
  .section-heading h3,
  .tab-heading h3 {
    margin: 0 0 6px;
  }
  .page-heading h2 {
    font-size: 22px;
  }
  .page-heading p,
  .section-heading p,
  .tab-heading p,
  .adjustment-row p,
  .muted,
  .cell-note {
    margin: 0;
    color: var(--el-text-color-secondary);
  }
  .page-actions,
  .inline-actions {
    display: flex;
    gap: 12px;
  }
  .onboarding-card :deep(.el-card__body) {
    padding-bottom: 0;
  }
  .step-content {
    min-height: 420px;
    padding: 28px 8px 8px;
  }
  .form-grid {
    display: grid;
    gap: 0 20px;
  }
  .two-columns {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .three-columns {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .confirmation-box {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 24px;
    padding: 16px;
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    background: var(--el-fill-color-lighter);
  }
  .confirmation-status {
    display: grid;
    grid-template-columns: max-content max-content max-content max-content;
    margin-top: 16px;
  }
  .issue-table {
    margin-top: 16px;
  }
  .step-actions {
    position: sticky;
    bottom: 0;
    z-index: 2;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 8px;
    border-top: 1px solid var(--el-border-color);
    background: var(--el-bg-color);
  }
  .profile-card :deep(.el-descriptions__label) {
    width: 130px;
  }
  .management-tabs {
    min-height: 420px;
  }
  .tab-heading {
    margin-bottom: 16px;
  }
  .tab-form,
  .reason-form,
  .history-title,
  .stock-form {
    margin-top: 20px;
  }
  .treatment-meta {
    max-width: 760px;
  }
  .adjustment-row {
    margin: 4px 0 16px;
    padding: 14px 16px;
    border-radius: 8px;
    background: var(--el-fill-color-lighter);
  }
  .drug-table {
    margin-bottom: 16px;
  }
  .cell-note {
    margin-top: 4px;
    font-size: 12px;
  }
  .dose-input {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dose-input :deep(.el-input-number) {
    width: 104px;
  }
  .empty-medication {
    padding: 36px;
    text-align: center;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-lighter);
  }
  .dispense-switch {
    margin-bottom: 16px;
  }
  .dispense-panel,
  .stock-form {
    padding: 16px;
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
  }
  .dispense-items {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 20px;
    margin-bottom: 16px;
  }
  .dispense-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }
  .status-summary {
    margin-bottom: 16px;
  }
  :deep(.el-date-editor.el-input),
  .el-select {
    width: 100%;
  }
  @media (max-width: 900px) {
    .three-columns {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .profile-card :deep(.el-descriptions) {
      overflow-x: auto;
    }
  }
  @media (max-width: 700px) {
    .page-heading,
    .section-heading,
    .tab-heading {
      align-items: flex-start;
      flex-direction: column;
    }
    .two-columns,
    .three-columns,
    .dispense-items {
      grid-template-columns: 1fr;
    }
    .step-content {
      min-height: 0;
      padding-top: 24px;
    }
    .page-actions {
      width: 100%;
    }
  }
</style>
