<template>
  <ElDialog
    v-model="visible"
    title="不良反应评估与跟进"
    width="min(1040px, calc(100vw - 32px))"
    top="4vh"
    class="assessment-dialog"
    :close-on-click-modal="false"
    :before-close="close"
    destroy-on-close
  >
    <div v-loading="loading" class="assessment-content">
      <template v-if="record">
        <section class="report-summary" aria-label="患者与原始上报信息">
          <div class="patient-heading">
            <div class="patient-identity">
              <strong>{{ record.patient_name }}</strong>
              <span>{{ record.patient_mobile || '未填写手机号' }}</span>
            </div>
            <ElTag :type="statusType(record.processing_status)">
              {{ record.processing_status || '待处理' }}
            </ElTag>
          </div>
          <div class="membership">
            <div><span>参与项目</span>{{ record.project_name || '未参与项目' }}</div>
            <div><span>入组名称</span>{{ record.group_name || '未入组' }}</div>
          </div>
          <div class="original-report">
            <div class="report-heading">
              <strong>原始上报</strong>
              <span>{{ record.symptom_summary || '未填写症状' }}</span>
              <ElTag :type="severityType(record.severity)" size="small" effect="plain">
                {{ record.severity_text }}
              </ElTag>
              <span class="occurred-at">发生于 {{ record.occurred_at }}</span>
            </div>
            <p>{{ record.symptom_description || '暂无补充描述' }}</p>
          </div>
        </section>

        <ElTabs v-model="activeTab" class="assessment-tabs">
          <ElTabPane label="事件评估" name="assessment">
            <ElForm
              ref="assessmentForm"
              :model="form"
              :rules="assessmentRules"
              :validate-on-rule-change="false"
              label-position="top"
              :disabled="saving"
              scroll-to-error
            >
              <section class="form-section">
                <h3>事件判断</h3>
                <div class="form-grid">
                  <ElFormItem label="事件名称" prop="event_name">
                    <ElInput
                      v-model="form.event_name"
                      placeholder="请输入本次评估的事件名称"
                      maxlength="2000"
                    />
                  </ElFormItem>
                  <ElFormItem label="事件分类" prop="category">
                    <ElSelect v-model="form.category">
                      <ElOption label="一般症状" value="一般症状" />
                      <ElOption label="不良事件（AE）" value="AE" />
                    </ElSelect>
                  </ElFormItem>
                  <ElFormItem label="研究者评估严重程度" prop="assessed_severity">
                    <ElRadioGroup v-model="form.assessed_severity">
                      <ElRadioButton :value="1">轻度</ElRadioButton>
                      <ElRadioButton :value="2">中度</ElRadioButton>
                      <ElRadioButton :value="3">重度</ElRadioButton>
                    </ElRadioGroup>
                  </ElFormItem>
                  <ElFormItem label="与用药的相关性" prop="relatedness">
                    <ElInput
                      v-model="form.relatedness"
                      placeholder="请输入研究者判断及依据"
                      maxlength="2000"
                    />
                  </ElFormItem>
                </div>
                <div class="event-attributes">
                  <div class="attribute-options">
                    <span>事件属性</span>
                    <ElCheckbox v-model="form.serious">符合严重事件条件</ElCheckbox>
                    <ElCheckbox v-model="form.special_interest">特别关注事件</ElCheckbox>
                  </div>
                  <p>严重程度、严重性和特别关注属性需分别判断。</p>
                </div>
              </section>

              <section class="form-section">
                <h3>处置与结局</h3>
                <div class="form-grid">
                  <ElFormItem label="处理状态" prop="processing_status">
                    <ElSelect v-model="form.processing_status">
                      <ElOption
                        v-for="status in ['待处理', '处理中', '已处理']"
                        :key="status"
                        :label="status"
                        :value="status"
                      />
                    </ElSelect>
                  </ElFormItem>
                  <ElFormItem label="负责人员" prop="owner_id">
                    <ElSelect v-model="form.owner_id" placeholder="请选择负责人员" filterable>
                      <ElOption
                        v-for="owner in owners"
                        :key="owner.id"
                        :label="owner.realname || owner.username"
                        :value="owner.id"
                        :disabled="owner.status !== 1"
                      />
                    </ElSelect>
                  </ElFormItem>
                  <ElFormItem label="采取措施" prop="measures" class="full-width">
                    <ElInput
                      v-model="form.measures"
                      type="textarea"
                      :rows="2"
                      resize="vertical"
                      placeholder="请记录已采取的处置措施"
                      maxlength="2000"
                      show-word-limit
                    />
                  </ElFormItem>
                  <ElFormItem label="结局 / 处理结果" prop="outcome" :rules="outcomeRules">
                    <ElInput
                      v-model="form.outcome"
                      :placeholder="
                        form.processing_status === '已处理' ? '已处理时必填' : '有处理结果后填写'
                      "
                      maxlength="2000"
                    />
                  </ElFormItem>
                  <ElFormItem label="结束时间" prop="ended_at">
                    <ElDatePicker
                      v-model="form.ended_at"
                      type="datetime"
                      value-format="YYYY-MM-DD HH:mm:ss"
                      placeholder="事件结束后填写（选填）"
                    />
                  </ElFormItem>
                  <ElFormItem label="本次评估说明" prop="reason" class="full-width">
                    <ElInput
                      v-model="form.reason"
                      type="textarea"
                      :rows="2"
                      resize="vertical"
                      placeholder="请说明本次判断或调整的依据，将保存至评估记录"
                      maxlength="2000"
                      show-word-limit
                    />
                  </ElFormItem>
                </div>
              </section>
            </ElForm>
          </ElTabPane>

          <ElTabPane :label="`联系跟进（${record.contacts?.length || 0}）`" name="contacts">
            <section class="form-section">
              <h3>登记本次联系</h3>
              <p class="section-description">记录已经完成的联系及后续安排。</p>
              <ElForm
                ref="contactForm"
                :model="contact"
                :rules="contactRules"
                label-position="top"
                :disabled="saving"
                scroll-to-error
              >
                <div class="form-grid">
                  <ElFormItem label="联系渠道" prop="channel">
                    <ElInput
                      v-model="contact.channel"
                      placeholder="如电话、院内沟通"
                      maxlength="2000"
                    />
                  </ElFormItem>
                  <ElFormItem label="联系结果" prop="result">
                    <ElInput
                      v-model="contact.result"
                      type="textarea"
                      :rows="2"
                      resize="vertical"
                      placeholder="请记录实际联系情况"
                      maxlength="2000"
                    />
                  </ElFormItem>
                  <ElFormItem label="后续安排" prop="next_action" class="full-width">
                    <ElInput
                      v-model="contact.next_action"
                      type="textarea"
                      :rows="2"
                      resize="vertical"
                      placeholder="请记录下一步安排"
                      maxlength="2000"
                      show-word-limit
                    />
                  </ElFormItem>
                </div>
              </ElForm>
            </section>
            <section class="form-section history-section">
              <h3
                >联系记录 <span>{{ record.contacts?.length || 0 }} 条</span></h3
              >
              <ElEmpty
                v-if="!record.contacts?.length"
                description="暂无联系记录"
                :image-size="64"
              />
              <ElTimeline v-else>
                <ElTimelineItem
                  v-for="(item, index) in record.contacts"
                  :key="index"
                  :timestamp="item.time"
                  placement="top"
                >
                  <article class="history-card">
                    <div class="history-heading"
                      ><strong>{{ item.channel }}</strong
                      ><span>{{ item.operator || '未记录登记人' }}</span></div
                    >
                    <p><span>联系结果</span>{{ item.result }}</p>
                    <p><span>后续安排</span>{{ item.next_action }}</p>
                  </article>
                </ElTimelineItem>
              </ElTimeline>
            </section>
          </ElTabPane>

          <ElTabPane
            :label="`评估记录（${record.processing_history?.length || 0}）`"
            name="history"
          >
            <section class="form-section history-section">
              <h3>历次评估</h3>
              <p class="section-description">按时间倒序展示每次保存的评估与处置说明。</p>
              <ElEmpty
                v-if="!record.processing_history?.length"
                description="暂无评估记录，保存评估后将在此展示"
                :image-size="72"
              />
              <ElTimeline v-else>
                <ElTimelineItem
                  v-for="(item, index) in record.processing_history"
                  :key="index"
                  :timestamp="item.time"
                  placement="top"
                  :type="index === 0 ? 'primary' : undefined"
                >
                  <article class="history-card">
                    <div class="history-heading"
                      ><strong>{{ item.operator }}</strong
                      ><ElTag v-if="index === 0" size="small" effect="plain">最近一次</ElTag></div
                    >
                    <p class="assessment-reason">{{ item.reason }}</p>
                    <template v-if="item.after">
                      <div class="history-tags">
                        <ElTag type="info" size="small">{{ item.after.category }}</ElTag>
                        <ElTag :type="severityType(item.after.assessed_severity)" size="small">{{
                          severityLabel(item.after.assessed_severity)
                        }}</ElTag>
                        <ElTag v-if="item.after.serious" type="danger" size="small">严重事件</ElTag>
                        <ElTag v-if="item.after.special_interest" type="warning" size="small"
                          >特别关注</ElTag
                        >
                      </div>
                      <p><span>事件名称</span>{{ item.after.event_name }}</p>
                      <p><span>采取措施</span>{{ item.after.measures || '未填写' }}</p>
                      <p><span>处理结果</span>{{ item.after.outcome || '尚无结局' }}</p>
                    </template>
                  </article>
                </ElTimelineItem>
              </ElTimeline>
            </section>
          </ElTabPane>
        </ElTabs>
      </template>
      <ElEmpty v-else-if="!loading" description="加载失败，请关闭后重试" :image-size="72" />
    </div>
    <template #footer>
      <div class="dialog-footer">
        <span class="footer-hint">{{
          activeTab === 'contacts'
            ? '联系记录与事件评估分别保存'
            : activeTab === 'assessment'
              ? '* 为必填项；原始上报内容保持留存'
              : '评估记录按保存时间留存'
        }}</span>
        <div class="footer-actions">
          <ElButton :disabled="saving" @click="visible = false">关闭</ElButton>
          <ElButton
            v-if="record && activeTab === 'assessment'"
            type="primary"
            :loading="saving"
            :disabled="loading"
            @click="save"
            >保存评估</ElButton
          >
          <ElButton
            v-if="record && activeTab === 'contacts'"
            type="primary"
            :loading="saving"
            :disabled="loading"
            @click="saveContact"
            >登记联系</ElButton
          >
        </div>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref } from 'vue'
  import type { FormInstance, FormItemRule, FormRules } from 'element-plus'
  import type { AdverseReactionRecord } from '@/api/adverse-reaction'
  import request from '@/utils/http'

  interface AssessmentForm {
    processing_status: string
    owner_id?: number
    event_name: string
    category: string
    assessed_severity: number
    serious: boolean
    special_interest: boolean
    relatedness: string
    measures: string
    outcome: string
    ended_at: string | null
    reason: string
  }
  interface ContactForm {
    channel: string
    result: string
    next_action: string
  }
  interface AssessmentRecord extends AdverseReactionRecord {
    assessment?: Partial<AssessmentForm>
    assessment_revision?: number
    contacts?: (ContactForm & { time: string; operator: string })[]
    processing_history?: {
      time: string
      operator: string
      reason: string
      after?: AssessmentForm
    }[]
  }
  const blank = (): AssessmentForm => ({
    processing_status: '待处理',
    event_name: '',
    category: '一般症状',
    assessed_severity: 1,
    serious: false,
    special_interest: false,
    relatedness: '',
    measures: '',
    outcome: '',
    ended_at: '',
    reason: ''
  })
  const blankContact = (): ContactForm => ({ channel: '', result: '', next_action: '' })
  const emit = defineEmits<{ saved: [] }>()
  const visible = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const activeTab = ref('assessment')
  const record = ref<AssessmentRecord>()
  const form = ref(blank())
  const contact = ref(blankContact())
  const assessmentForm = ref<FormInstance>()
  const contactForm = ref<FormInstance>()
  const owners = ref<{ id: number; realname: string; username: string; status: number }[]>([])
  const requiredText = (message: string): FormItemRule => ({
    required: true,
    whitespace: true,
    message,
    trigger: 'blur'
  })
  const outcomeRules = computed<FormItemRule[]>(() =>
    form.value.processing_status === '已处理'
      ? [requiredText('标记为已处理时，请填写结局 / 处理结果')]
      : []
  )
  const assessmentRules: FormRules<AssessmentForm> = {
    event_name: [requiredText('请输入事件名称')],
    category: [{ required: true, message: '请选择事件分类', trigger: 'change' }],
    assessed_severity: [{ required: true, message: '请选择评估严重程度', trigger: 'change' }],
    relatedness: [requiredText('请填写与用药的相关性')],
    processing_status: [{ required: true, message: '请选择处理状态', trigger: 'change' }],
    owner_id: [{ required: true, message: '请选择负责人员', trigger: 'change' }],
    measures: [requiredText('请填写采取措施')],
    reason: [requiredText('请填写本次评估说明')],
    ended_at: [
      {
        validator: (_rule, value, callback) => {
          if (value && record.value && value < record.value.occurred_at)
            callback(new Error('结束时间不能早于发生时间'))
          else callback()
        },
        trigger: 'change'
      }
    ]
  }
  const contactRules: FormRules<ContactForm> = {
    channel: [requiredText('请填写联系渠道')],
    result: [requiredText('请填写联系结果')],
    next_action: [requiredText('请填写后续安排')]
  }
  const severityType = (value: number) =>
    value === 3 ? 'danger' : value === 2 ? 'warning' : 'success'
  const severityLabel = (value: number) => ({ 1: '轻度', 2: '中度', 3: '重度' })[value] || '未评估'
  const statusType = (value?: string) =>
    value === '已处理' ? 'success' : value === '处理中' ? 'primary' : 'warning'

  async function open(id: number) {
    if (loading.value || saving.value) return
    visible.value = true
    loading.value = true
    record.value = undefined
    activeTab.value = 'assessment'
    form.value = blank()
    contact.value = blankContact()
    try {
      const [detail, admins] = await Promise.all([
        request.get<AssessmentRecord>({
          url: '/app/core/adverse-reaction/assessment',
          params: { id }
        }),
        request.get<typeof owners.value>({ url: '/app/core/admin/index' })
      ])
      record.value = detail
      owners.value = admins
      form.value = {
        ...blank(),
        ...detail.assessment,
        processing_status: detail.processing_status || '待处理',
        reason: ''
      }
      await nextTick()
      assessmentForm.value?.clearValidate()
      contactForm.value?.clearValidate()
    } finally {
      loading.value = false
    }
  }
  async function save() {
    if (
      !record.value ||
      saving.value ||
      !(await assessmentForm.value?.validate().catch(() => false))
    )
      return
    saving.value = true
    try {
      const saved = await request.post<AssessmentRecord>({
        url: '/app/core/adverse-reaction/assess',
        params: {
          ...form.value,
          id: record.value.id,
          revision: record.value.assessment_revision || 0
        },
        showSuccessMessage: true
      })
      record.value = { ...record.value, ...saved }
      form.value = {
        ...blank(),
        ...saved.assessment,
        processing_status: saved.processing_status || '待处理',
        reason: ''
      }
      await nextTick()
      assessmentForm.value?.clearValidate()
      emit('saved')
    } finally {
      saving.value = false
    }
  }
  async function saveContact() {
    if (!record.value || saving.value || !(await contactForm.value?.validate().catch(() => false)))
      return
    saving.value = true
    try {
      const saved = await request.post<AssessmentRecord>({
        url: '/app/core/adverse-reaction/contact',
        params: { id: record.value.id, ...contact.value },
        showSuccessMessage: true
      })
      // Contact registration must not replace an assessment draft or its revision.
      record.value.contacts = saved.contacts
      contact.value = blankContact()
      await nextTick()
      contactForm.value?.clearValidate()
    } finally {
      saving.value = false
    }
  }
  function close(done: () => void) {
    if (!saving.value) done()
  }
  defineExpose({ open })
</script>

<style scoped lang="scss">
  .assessment-content {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .report-summary {
    flex-shrink: 0;
    max-height: 200px;
    padding: 16px 0;
    overflow-y: auto;
  }

  .patient-heading,
  .patient-identity,
  .report-heading,
  .attribute-options,
  .history-heading,
  .dialog-footer,
  .footer-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .patient-heading,
  .dialog-footer {
    justify-content: space-between;
  }

  .patient-identity strong {
    font-size: 18px;
    color: var(--el-text-color-primary);
  }

  .patient-identity > span,
  .occurred-at,
  .section-description,
  .footer-hint {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .membership {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 24px;
    margin-top: 10px;
    overflow-wrap: anywhere;
  }

  .membership span {
    margin-right: 12px;
    color: var(--el-text-color-secondary);
  }

  .original-report {
    padding: 10px 12px;
    margin-top: 12px;
    background: var(--el-fill-color-light);
    border-radius: 6px;
  }

  .report-heading {
    flex-wrap: wrap;
    gap: 6px 10px;
  }

  .occurred-at {
    margin-left: auto;
  }

  .original-report p {
    margin: 6px 0 0;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .assessment-tabs {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .assessment-tabs :deep(.el-tabs__header) {
    flex-shrink: 0;
    margin-bottom: 0;
  }

  .assessment-tabs :deep(.el-tabs__content) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .form-section {
    padding: 20px 8px 0 0;
  }

  .form-section + .form-section {
    margin-top: 6px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .form-section h3 {
    margin: 0 0 16px;
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 24px;
  }

  .full-width {
    grid-column: 1 / -1;
  }

  .form-grid :deep(.el-form-item) {
    margin-bottom: 20px;
  }

  .form-grid :deep(.el-form-item__label) {
    height: auto !important;
    margin-bottom: 8px;
    line-height: 20px !important;
  }

  .form-grid :deep(.el-select),
  .form-grid :deep(.el-date-editor) {
    width: 100%;
  }

  .event-attributes {
    padding: 10px 14px;
    margin-bottom: 20px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .attribute-options {
    flex-wrap: wrap;
    gap: 4px 20px;
  }

  .attribute-options :deep(.el-checkbox) {
    margin-right: 0;
  }

  .event-attributes p {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .section-description {
    margin: -8px 0 20px;
  }

  .history-section {
    padding-bottom: 16px;
  }

  .history-section h3 > span {
    margin-left: 8px;
    font-size: 12px;
    font-weight: 400;
    color: var(--el-text-color-secondary);
  }

  .history-section :deep(.el-timeline) {
    padding-left: 4px;
  }

  .history-card {
    padding: 12px 16px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .history-heading {
    justify-content: space-between;
  }

  .history-heading > span {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .history-card p {
    margin: 10px 0 0;
    line-height: 1.6;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .history-card p > span {
    margin-right: 12px;
    color: var(--el-text-color-secondary);
  }

  .history-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .footer-actions {
    flex-shrink: 0;
    gap: 8px;
  }

  .footer-actions :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  @media (width <= 640px) {
    .form-grid,
    .membership {
      grid-template-columns: 1fr;
    }

    .footer-hint {
      display: none;
    }

    .dialog-footer {
      justify-content: flex-end;
    }

    .occurred-at {
      width: 100%;
      margin-left: 0;
    }
  }
</style>

<style lang="scss">
  .assessment-dialog {
    display: flex;
    flex-direction: column;
    height: min(880px, 92vh);
    padding: 0;
    margin-bottom: 0;
    overflow: hidden;

    .el-dialog__header {
      padding: 20px 24px 16px;
      margin: 0;
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    .el-dialog__body {
      display: flex;
      flex: 1;
      min-height: 0;
      padding: 0 24px !important;
    }

    .el-dialog__footer {
      padding: 14px 24px;
      border-top: 1px solid var(--el-border-color-lighter);
    }
  }

  @media (width <= 640px) {
    .assessment-dialog .el-dialog__header,
    .assessment-dialog .el-dialog__footer {
      padding: 16px;
    }

    .assessment-dialog .el-dialog__body {
      padding: 0 16px !important;
    }
  }
</style>
