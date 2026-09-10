<template>
  <div class="patient-detail-page">
    <div class="toolbar">
      <div>
        <h2>患者详情</h2>
        <p v-if="patient.id"
          >查看 {{ patient.name || '-' }} 的分组用药、每日反馈、检查报告及研究记录。</p
        >
      </div>
      <div class="actions">
        <ElButton @click="goBack">返回患者列表</ElButton>
        <ElButton @click="loadAll" :loading="pageLoading">刷新</ElButton>
      </div>
    </div>

    <ElCard shadow="never" v-loading="patientLoading">
      <div class="patient-base">
        <div><span>患者姓名：</span>{{ patient.name || '-' }}</div>
        <div><span>手机号：</span>{{ patient.mobile || '-' }}</div>
        <div><span>性别：</span>{{ patient.gender_text || '-' }}</div>
        <div><span>出生日期：</span>{{ patient.birth_date || '-' }}</div>
        <div><span>年龄：</span>{{ patient.age ?? '-' }}</div>
        <div><span>患者端登录：</span>{{ patient.login_enabled ? '可登录' : '不可登录' }}</div>
        <div><span>研究项目：</span>{{ patient.project_name || '-' }}</div>
        <div><span>研究分组：</span>{{ patient.group_name || '-' }}</div>
        <div><span>用药方案：</span>{{ patient.medication_scheme_name || '-' }}</div>
        <div><span>入组日期：</span>{{ patient.enroll_date || '-' }}</div>
      </div>
    </ElCard>

    <ElCard shadow="never">
      <ElTabs v-model="activeTab" @tab-change="handleTabChange">
        <ElTabPane label="今日用药计划" name="today">
          <ElTable :data="todayPlans.list" v-loading="todayPlans.loading" border>
            <ElTableColumn prop="name" label="药品名称" min-width="180" />
            <ElTableColumn prop="specification" label="规格" min-width="140" />
            <ElTableColumn prop="usage" label="服用方式" min-width="120" />
            <ElTableColumn prop="dosage" label="剂量" min-width="120" />
            <ElTableColumn prop="plan_date" label="计划日期" min-width="120" />
            <ElTableColumn prop="day_number" label="第几天" width="90" />
            <ElTableColumn prop="plan_time" label="提醒时间" width="100" />
            <ElTableColumn label="状态" width="100">
              <template #default="{ row }">
                <ElTag :type="row.status === 1 ? 'success' : 'warning'">
                  {{ row.status_text }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="checked_at" label="打卡时间" min-width="180" />
          </ElTable>
          <div class="pagination">
            <ElPagination
              v-model:current-page="todayPlans.pagination.current"
              v-model:page-size="todayPlans.pagination.size"
              :total="todayPlans.pagination.total"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, prev, pager, next, sizes, jumper"
              background
              @current-change="loadTodayPlans"
              @size-change="handleTodaySizeChange"
            />
          </div>
        </ElTabPane>

        <ElTabPane label="全部用药计划" name="all">
          <div class="tab-toolbar">
            <ElDatePicker
              v-model="allPlans.planDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="请选择计划日期"
              clearable
              style="width: 180px"
              @change="handleAllSearch"
            />
            <ElButton type="primary" @click="handleAllSearch">查询</ElButton>
          </div>

          <ElTable :data="allPlans.list" v-loading="allPlans.loading" border>
            <ElTableColumn prop="name" label="药品名称" min-width="180" />
            <ElTableColumn prop="specification" label="规格" min-width="140" />
            <ElTableColumn prop="usage" label="服用方式" min-width="120" />
            <ElTableColumn prop="dosage" label="剂量" min-width="120" />
            <ElTableColumn prop="plan_date" label="计划日期" min-width="120" />
            <ElTableColumn prop="day_number" label="第几天" width="90" />
            <ElTableColumn prop="plan_time" label="提醒时间" width="100" />
            <ElTableColumn label="状态" width="100">
              <template #default="{ row }">
                <ElTag :type="row.status === 1 ? 'success' : 'warning'">
                  {{ row.status_text }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="checked_at" label="打卡时间" min-width="180" />
          </ElTable>
          <div class="pagination">
            <ElPagination
              v-model:current-page="allPlans.pagination.current"
              v-model:page-size="allPlans.pagination.size"
              :total="allPlans.pagination.total"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, prev, pager, next, sizes, jumper"
              background
              @current-change="loadAllPlans"
              @size-change="handleAllSizeChange"
            />
          </div>
        </ElTabPane>

        <ElTabPane label="患者药品" name="medicine">
          <ElAlert
            :title="`所属分组：${patient.group_name || '-'}；用药方案：${patient.medication_scheme_name || '-'}`"
            type="info"
            :closable="false"
            show-icon
            class="scheme-alert"
          />
          <ElTable :data="medicines.list" v-loading="medicines.loading" border>
            <ElTableColumn prop="name" label="药品名称" min-width="180" />
            <ElTableColumn prop="specification" label="规格" min-width="140" />
            <ElTableColumn prop="usage" label="服用方式" min-width="120" />
            <ElTableColumn prop="dosage" label="剂量" min-width="120" />
            <ElTableColumn prop="frequency" label="频次/天" width="90" />
            <ElTableColumn prop="source_text" label="来源" width="100" />
            <ElTableColumn prop="created_at" label="添加时间" min-width="180" />
            <ElTableColumn label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <ElButton
                  link
                  type="primary"
                  @click="openMedicineDetail(row as PatientMedicineRecord)"
                  >查看</ElButton
                >
              </template>
            </ElTableColumn>
          </ElTable>
          <div class="pagination">
            <ElPagination
              v-model:current-page="medicines.pagination.current"
              v-model:page-size="medicines.pagination.size"
              :total="medicines.pagination.total"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, prev, pager, next, sizes, jumper"
              background
              @current-change="loadMedicines"
              @size-change="handleMedicineSizeChange"
            />
          </div>
        </ElTabPane>

        <ElTabPane label="问卷答题情况" name="survey">
          <ElTable :data="surveyList" v-loading="surveyLoading" border>
            <ElTableColumn prop="name" label="问卷名称" min-width="180" />
            <ElTableColumn prop="code" label="模板编码" min-width="180" />
            <ElTableColumn prop="fillable_day" label="建档后第几天可填" width="150" />
            <ElTableColumn prop="fillable_date" label="可填写日期" min-width="120" />
            <ElTableColumn label="是否到期可填" width="120">
              <template #default="{ row }">
                <ElTag :type="row.fillable ? 'success' : 'info'">
                  {{ row.fillable ? '是' : '否' }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="答题情况" width="120">
              <template #default="{ row }">
                <ElTag :type="row.answered ? 'success' : 'warning'">
                  {{ row.answered ? '已作答' : '未作答' }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="submitted_at" label="提交时间" min-width="180" />
            <ElTableColumn label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <ElButton
                  link
                  type="primary"
                  :disabled="!row.answered"
                  @click="openSurveyAnswerDetail(row)"
                >
                  查看答题
                </ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>

        <ElTabPane label="不良反应上报" name="adverse">
          <ElTable :data="adverseReactions.list" v-loading="adverseReactions.loading" border>
            <ElTableColumn prop="occurred_at" label="发生时间" min-width="160" />
            <ElTableColumn prop="symptom_summary" label="主要症状" min-width="220" />
            <ElTableColumn label="严重程度" width="100">
              <template #default="{ row }">
                <ElTag :type="severityTagType(row.severity)">
                  {{ row.severity_text }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="created_at" label="上报时间" min-width="180" />
            <ElTableColumn label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <ElButton
                  link
                  type="primary"
                  @click="openAdverseReactionDetail(row as PatientAdverseReactionRecord)"
                  >查看</ElButton
                >
              </template>
            </ElTableColumn>
          </ElTable>
          <div class="pagination">
            <ElPagination
              v-model:current-page="adverseReactions.pagination.current"
              v-model:page-size="adverseReactions.pagination.size"
              :total="adverseReactions.pagination.total"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, prev, pager, next, sizes, jumper"
              background
              @current-change="loadAdverseReactions"
              @size-change="handleAdverseSizeChange"
            />
          </div>
        </ElTabPane>

        <ElTabPane label="每日反馈" name="feedback" lazy>
          <FeedbackRecords embedded :user-id="userId" />
        </ElTabPane>

        <ElTabPane label="检查报告" name="reports" lazy>
          <PatientReports embedded :user-id="userId" />
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <ElDialog v-model="answerDialogVisible" title="问卷答题详情" width="900px">
      <div v-loading="answerDetailLoading" class="answer-detail" v-if="answerDetail">
        <div class="answer-base">
          <div><span>问卷名称：</span>{{ answerDetail.template.name }}</div>
          <div><span>模板编码：</span>{{ answerDetail.template.code }}</div>
          <div><span>提交时间：</span>{{ answerDetail.submitted_at || '-' }}</div>
          <div class="full"
            ><span>问卷说明：</span>{{ answerDetail.template.description || '无' }}</div
          >
        </div>

        <ElCard
          v-for="question in answerDetail.questions"
          :key="question.question_id"
          shadow="never"
          class="answer-question-card"
        >
          <template #header>
            <div class="answer-question-header">
              <span>第 {{ question.question_no }} 题</span>
              <div class="answer-question-tags">
                <ElTag size="small">{{ question.type }}</ElTag>
                <ElTag v-if="question.required" size="small" type="danger">必填</ElTag>
              </div>
            </div>
          </template>

          <div class="answer-question-title">{{ question.title }}</div>
          <div class="answer-summary"> <span>作答结果：</span>{{ question.answer_summary }} </div>

          <div v-if="question.selected_options.length" class="selected-option-list">
            <div
              v-for="option in question.selected_options"
              :key="option.id"
              class="selected-option-item"
            >
              <div class="selected-option-label">{{ option.label }}</div>
              <div v-if="option.input_fields.length" class="selected-option-fields">
                <div v-for="field in option.input_fields" :key="field.field_key">
                  <span>{{ field.field_label }}：</span>{{ field.value || '-' }}
                </div>
              </div>
            </div>
          </div>
        </ElCard>
      </div>
    </ElDialog>

    <ElDialog v-model="adverseDialogVisible" title="不良反应详情" width="720px">
      <div v-if="currentAdverseReaction" class="answer-detail">
        <div class="answer-base">
          <div><span>发生时间：</span>{{ currentAdverseReaction.occurred_at || '-' }}</div>
          <div>
            <span>严重程度：</span>
            <ElTag :type="severityTagType(currentAdverseReaction.severity)">
              {{ currentAdverseReaction.severity_text || '-' }}
            </ElTag>
          </div>
          <div class="full"
            ><span>主要症状：</span>{{ currentAdverseReaction.symptom_summary || '-' }}</div
          >
          <div class="full">
            <span>症状描述：</span>{{ currentAdverseReaction.symptom_description || '无' }}
          </div>
          <div class="full"
            ><span>处理建议：</span>{{ currentAdverseReaction.advice_text || '无' }}</div
          >
        </div>
      </div>
    </ElDialog>

    <ElDialog v-model="medicineDialogVisible" title="患者药品详情" width="760px">
      <div v-if="currentMedicine" class="answer-detail">
        <div class="answer-base">
          <div><span>药品名称：</span>{{ currentMedicine.name || '-' }}</div>
          <div><span>商品名：</span>{{ currentMedicine.trade_name || '-' }}</div>
          <div><span>规格：</span>{{ currentMedicine.specification || '-' }}</div>
          <div><span>服用方式：</span>{{ currentMedicine.usage || '-' }}</div>
          <div><span>剂量：</span>{{ currentMedicine.dosage || '-' }}</div>
          <div><span>频次/天：</span>{{ currentMedicine.frequency || 0 }}</div>
          <div><span>数量：</span>{{ currentMedicine.medicine_count || '-' }}</div>
          <div><span>厂家：</span>{{ currentMedicine.company || '-' }}</div>
          <div><span>医保码：</span>{{ currentMedicine.ybm || '-' }}</div>
          <div><span>批次号：</span>{{ currentMedicine.batch_no || '-' }}</div>
          <div><span>来源：</span>{{ currentMedicine.source_text || '-' }}</div>
          <div><span>添加时间：</span>{{ currentMedicine.created_at || '-' }}</div>
          <div class="full"><span>备注：</span>{{ currentMedicine.remark || '无' }}</div>
          <div class="full"
            ><span>用药指导：</span>{{ currentMedicine.medication_guidance || '无' }}</div
          >
        </div>
      </div>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import FeedbackRecords from '@/views/admin/feedback/index.vue'
  import PatientReports from '@/views/admin/reports/index.vue'
  import { fetchMedicationPlanList, type MedicationPlanRecord } from '@/api/medication-plan'
  import {
    fetchPatientAdverseReactionList,
    fetchPatientMedicineList,
    fetchPatientSurveyAnswerDetail,
    fetchPatientDetail,
    fetchPatientSurveyStatus,
    type PatientAdverseReactionRecord,
    type PatientMedicineRecord,
    type PatientSurveyAnswerDetail,
    type PatientRecord,
    type PatientSurveyStatusRecord
  } from '@/api/patient'
  import { useRoute, useRouter } from 'vue-router'

  defineOptions({ name: 'PatientDetail' })

  const route = useRoute()
  const router = useRouter()
  const userId = computed(() => {
    const value = route.query.user_id
    return typeof value === 'string' && value ? Number(value) : 0
  })

  const activeTab = ref<
    'today' | 'all' | 'medicine' | 'survey' | 'adverse' | 'feedback' | 'reports'
  >('today')
  const pageLoading = ref(false)
  const patientLoading = ref(false)
  const surveyLoading = ref(false)
  const answerDetailLoading = ref(false)
  const answerDialogVisible = ref(false)
  const adverseDialogVisible = ref(false)
  const medicineDialogVisible = ref(false)
  const patient = reactive<PatientRecord>({
    id: 0,
    name: '',
    mobile: '',
    gender: 0,
    gender_text: '',
    birth_date: '',
    age: 0,
    is_archived: 0,
    login_enabled: false,
    created_via: '',
    enroll_date: '',
    status: 0,
    created_at: '',
    updated_at: ''
  })
  const surveyList = ref<PatientSurveyStatusRecord[]>([])
  const answerDetail = ref<PatientSurveyAnswerDetail>()
  const currentAdverseReaction = ref<PatientAdverseReactionRecord>()
  const currentMedicine = ref<PatientMedicineRecord>()

  const todayPlans = reactive({
    loading: false,
    list: [] as MedicationPlanRecord[],
    pagination: {
      current: 1,
      size: 10,
      total: 0
    }
  })

  const allPlans = reactive({
    loading: false,
    list: [] as MedicationPlanRecord[],
    planDate: '',
    pagination: {
      current: 1,
      size: 10,
      total: 0
    }
  })

  const medicines = reactive({
    loading: false,
    list: [] as PatientMedicineRecord[],
    pagination: {
      current: 1,
      size: 10,
      total: 0
    }
  })

  const adverseReactions = reactive({
    loading: false,
    list: [] as PatientAdverseReactionRecord[],
    pagination: {
      current: 1,
      size: 10,
      total: 0
    }
  })

  const severityTagType = (severity: number) => {
    if (severity === 3) return 'danger'
    if (severity === 2) return 'warning'
    return 'success'
  }

  const syncPatient = (data: PatientRecord) => {
    Object.assign(patient, data)
  }

  const loadPatientDetail = async () => {
    if (!userId.value) return
    patientLoading.value = true
    try {
      syncPatient(await fetchPatientDetail(userId.value))
    } finally {
      patientLoading.value = false
    }
  }

  const loadTodayPlans = async () => {
    if (!userId.value) return
    todayPlans.loading = true
    try {
      const res = await fetchMedicationPlanList({
        current: todayPlans.pagination.current,
        size: todayPlans.pagination.size,
        user_id: userId.value,
        scope: 'today'
      })
      todayPlans.list = res.list
      todayPlans.pagination.total = res.total
      todayPlans.pagination.current = res.current
      todayPlans.pagination.size = res.size
    } finally {
      todayPlans.loading = false
    }
  }

  const loadAllPlans = async () => {
    if (!userId.value) return
    allPlans.loading = true
    try {
      const res = await fetchMedicationPlanList({
        current: allPlans.pagination.current,
        size: allPlans.pagination.size,
        user_id: userId.value,
        scope: 'all',
        plan_date: allPlans.planDate || undefined
      })
      allPlans.list = res.list
      allPlans.pagination.total = res.total
      allPlans.pagination.current = res.current
      allPlans.pagination.size = res.size
    } finally {
      allPlans.loading = false
    }
  }

  const loadSurveyStatus = async () => {
    if (!userId.value) return
    surveyLoading.value = true
    try {
      surveyList.value = await fetchPatientSurveyStatus(userId.value)
    } finally {
      surveyLoading.value = false
    }
  }

  const loadMedicines = async () => {
    if (!userId.value) return
    medicines.loading = true
    try {
      const res = await fetchPatientMedicineList(
        userId.value,
        medicines.pagination.current,
        medicines.pagination.size
      )
      medicines.list = res.list
      medicines.pagination.total = res.total
      medicines.pagination.current = res.current
      medicines.pagination.size = res.size
    } finally {
      medicines.loading = false
    }
  }

  const openMedicineDetail = (row: PatientMedicineRecord) => {
    currentMedicine.value = row
    medicineDialogVisible.value = true
  }

  const openSurveyAnswerDetail = async (row: any) => {
    const record = row as PatientSurveyStatusRecord
    if (!userId.value || !record.answered) return

    answerDialogVisible.value = true
    answerDetailLoading.value = true
    try {
      answerDetail.value = await fetchPatientSurveyAnswerDetail(userId.value, record.template_id)
    } finally {
      answerDetailLoading.value = false
    }
  }

  const loadAdverseReactions = async () => {
    if (!userId.value) return
    adverseReactions.loading = true
    try {
      const res = await fetchPatientAdverseReactionList(
        userId.value,
        adverseReactions.pagination.current,
        adverseReactions.pagination.size
      )
      adverseReactions.list = res.list
      adverseReactions.pagination.total = res.total
      adverseReactions.pagination.current = res.current
      adverseReactions.pagination.size = res.size
    } finally {
      adverseReactions.loading = false
    }
  }

  const openAdverseReactionDetail = (row: PatientAdverseReactionRecord) => {
    currentAdverseReaction.value = row
    adverseDialogVisible.value = true
  }

  const handleTodaySizeChange = () => {
    todayPlans.pagination.current = 1
    loadTodayPlans()
  }

  const handleAllSizeChange = () => {
    allPlans.pagination.current = 1
    loadAllPlans()
  }

  const handleAllSearch = () => {
    allPlans.pagination.current = 1
    loadAllPlans()
  }

  const handleMedicineSizeChange = () => {
    medicines.pagination.current = 1
    loadMedicines()
  }

  const handleAdverseSizeChange = () => {
    adverseReactions.pagination.current = 1
    loadAdverseReactions()
  }

  const handleTabChange = (name: string | number) => {
    if (name === 'today') {
      loadTodayPlans()
      return
    }
    if (name === 'all') {
      loadAllPlans()
      return
    }
    if (name === 'medicine') {
      loadMedicines()
      return
    }
    if (name === 'survey') {
      loadSurveyStatus()
      return
    }
    if (name === 'adverse') loadAdverseReactions()
  }

  const loadAll = async () => {
    if (!userId.value) return
    pageLoading.value = true
    try {
      await loadPatientDetail()
      if (activeTab.value === 'today') {
        await loadTodayPlans()
      } else if (activeTab.value === 'all') {
        await loadAllPlans()
      } else if (activeTab.value === 'medicine') {
        await loadMedicines()
      } else if (activeTab.value === 'survey') {
        await loadSurveyStatus()
      } else if (activeTab.value === 'adverse') {
        await loadAdverseReactions()
      }
    } finally {
      pageLoading.value = false
    }
  }

  const goBack = () => {
    router.push('/patient/index')
  }

  watch(
    userId,
    () => {
      activeTab.value = 'today'
      todayPlans.pagination.current = 1
      allPlans.pagination.current = 1
      allPlans.planDate = ''
      medicines.pagination.current = 1
      adverseReactions.pagination.current = 1
      loadAll()
    },
    { immediate: true }
  )
</script>

<style scoped lang="scss">
  .patient-detail-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;

    h2 {
      margin: 0 0 6px;
      font-size: 22px;
      font-weight: 700;
    }

    p {
      margin: 0;
      color: #6b7280;
      font-size: 14px;
    }
  }

  .actions,
  .tab-toolbar {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .patient-base {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px 20px;

    span {
      color: #6b7280;
    }
  }

  .pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .scheme-alert {
    margin-bottom: 16px;
  }

  .answer-detail {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 160px;
  }

  .answer-base {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 20px;

    span {
      color: #6b7280;
    }

    .full {
      grid-column: 1 / -1;
    }
  }

  .answer-question-card {
    :deep(.el-card__header) {
      padding: 12px 16px;
    }
  }

  .answer-question-header,
  .answer-question-tags {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: space-between;
  }

  .answer-question-title {
    font-weight: 600;
    margin-bottom: 10px;
  }

  .answer-summary {
    margin-bottom: 12px;

    span {
      color: #6b7280;
    }
  }

  .selected-option-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .selected-option-item {
    padding: 10px 12px;
    border-radius: 8px;
    background: #f8fafc;
  }

  .selected-option-label {
    font-weight: 500;
    margin-bottom: 6px;
  }

  .selected-option-fields {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: #4b5563;

    span {
      color: #6b7280;
    }
  }

  @media (max-width: 1200px) {
    .patient-base {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .answer-base {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .toolbar {
      flex-direction: column;
      align-items: flex-start;
    }

    .patient-base {
      grid-template-columns: 1fr;
    }
  }
</style>
