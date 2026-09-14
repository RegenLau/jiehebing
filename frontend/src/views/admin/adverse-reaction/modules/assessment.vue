<template>
  <ElDialog
    v-model="visible"
    title="不良反应处理"
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
          <ElTabPane label="处理跟进" name="follow-up">
            <section class="form-section quick-follow-up">
              <div class="section-heading">
                <div>
                  <h3>本次处理</h3>
                  <p class="section-description">
                    第一版只需确认负责人、处理状态，并记录本次联系结果。
                  </p>
                </div>
                <ElTag effect="plain" type="info">必填 4 项</ElTag>
              </div>
              <ElForm
                ref="followUpForm"
                :model="followUp"
                :rules="followUpRules"
                label-position="top"
                :disabled="saving"
                scroll-to-error
              >
                <div class="form-grid compact-grid">
                  <ElFormItem label="处理状态" prop="processing_status">
                    <ElRadioGroup v-model="followUp.processing_status">
                      <ElRadioButton
                        v-for="status in ['待处理', '处理中', '已处理']"
                        :key="status"
                        :value="status"
                        >{{ status }}</ElRadioButton
                      >
                    </ElRadioGroup>
                  </ElFormItem>
                  <ElFormItem label="负责人" prop="owner_id">
                    <ElSelect v-model="followUp.owner_id" placeholder="请选择负责人" filterable>
                      <ElOption
                        v-for="owner in owners"
                        :key="owner.id"
                        :label="owner.realname || owner.username"
                        :value="owner.id"
                        :disabled="owner.status !== 1"
                      />
                    </ElSelect>
                  </ElFormItem>
                  <ElFormItem label="联系渠道" prop="channel">
                    <ElSelect v-model="followUp.channel">
                      <ElOption
                        v-for="channel in ['电话', '微信', '院内沟通', '其他']"
                        :key="channel"
                        :label="channel"
                        :value="channel"
                      />
                    </ElSelect>
                  </ElFormItem>
                  <ElFormItem label="本次联系结果" prop="result" class="full-width">
                    <ElInput
                      v-model="followUp.result"
                      type="textarea"
                      :rows="3"
                      resize="vertical"
                      placeholder="如：已联系患者，症状较昨日缓解，已提醒继续观察"
                      maxlength="2000"
                      show-word-limit
                    />
                  </ElFormItem>
                  <ElFormItem label="后续安排（选填）" prop="next_action" class="full-width">
                    <ElInput
                      v-model="followUp.next_action"
                      type="textarea"
                      :rows="2"
                      resize="vertical"
                      placeholder="如：明日上午再次电话确认；无需后续时可不填"
                      maxlength="2000"
                      show-word-limit
                    />
                  </ElFormItem>
                </div>
              </ElForm>
            </section>
          </ElTabPane>

          <ElTabPane :label="`处理记录（${record.contacts?.length || 0}）`" name="history">
            <section class="form-section history-section">
              <h3
                >联系跟进 <span>{{ record.contacts?.length || 0 }} 条</span></h3
              >
              <ElEmpty
                v-if="!record.contacts?.length"
                description="暂无处理记录"
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
                    <div class="history-heading">
                      <div class="history-title">
                        <strong>{{ item.channel }}</strong>
                        <ElTag v-if="item.processing_status" size="small" effect="plain">
                          {{ item.processing_status }}
                        </ElTag>
                      </div>
                      <span>{{ item.operator || '未记录登记人' }}</span>
                    </div>
                    <p v-if="item.owner_name"><span>负责人</span>{{ item.owner_name }}</p>
                    <p><span>联系结果</span>{{ item.result }}</p>
                    <p><span>后续安排</span>{{ item.next_action || '无' }}</p>
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
          activeTab === 'follow-up' ? '保存后会新增一条处理记录' : '记录按保存时间倒序展示'
        }}</span>
        <div class="footer-actions">
          <ElButton :disabled="saving" @click="visible = false">关闭</ElButton>
          <ElButton
            v-if="record && activeTab === 'follow-up'"
            type="primary"
            :loading="saving"
            :disabled="loading"
            @click="saveFollowUp"
            >保存处理记录</ElButton
          >
        </div>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { nextTick, ref } from 'vue'
  import type { FormInstance, FormItemRule, FormRules } from 'element-plus'
  import type { AdverseReactionRecord } from '@/api/adverse-reaction'
  import request from '@/utils/http'

  interface FollowUpForm {
    processing_status: string
    owner_id?: number
    channel: string
    result: string
    next_action: string
  }
  interface ContactRecord {
    channel: string
    result: string
    next_action: string
    time: string
    operator: string
    processing_status?: string
    owner_id?: number
    owner_name?: string
  }
  interface AssessmentRecord extends AdverseReactionRecord {
    owner_id?: number
    owner_name?: string
    assessment?: { owner_id?: number; owner_name?: string }
    assessment_revision?: number
    contacts?: ContactRecord[]
  }
  const blankFollowUp = (): FollowUpForm => ({
    processing_status: '待处理',
    channel: '电话',
    result: '',
    next_action: ''
  })
  const emit = defineEmits<{ saved: [] }>()
  const visible = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const activeTab = ref('follow-up')
  const record = ref<AssessmentRecord>()
  const followUp = ref(blankFollowUp())
  const followUpForm = ref<FormInstance>()
  const owners = ref<{ id: number; realname: string; username: string; status: number }[]>([])
  const requiredText = (message: string): FormItemRule => ({
    required: true,
    whitespace: true,
    message,
    trigger: 'blur'
  })
  const followUpRules: FormRules<FollowUpForm> = {
    processing_status: [{ required: true, message: '请选择处理状态', trigger: 'change' }],
    owner_id: [{ required: true, message: '请选择负责人', trigger: 'change' }],
    channel: [{ required: true, message: '请选择联系渠道', trigger: 'change' }],
    result: [requiredText('请填写本次联系结果')]
  }
  const severityType = (value: number) =>
    value === 3 ? 'danger' : value === 2 ? 'warning' : 'success'
  const statusType = (value?: string) =>
    value === '已处理' ? 'success' : value === '处理中' ? 'primary' : 'warning'

  async function open(id: number) {
    if (loading.value || saving.value) return
    visible.value = true
    loading.value = true
    record.value = undefined
    activeTab.value = 'follow-up'
    followUp.value = blankFollowUp()
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
      followUp.value = {
        ...blankFollowUp(),
        processing_status: detail.processing_status || '待处理',
        owner_id: detail.owner_id ?? detail.assessment?.owner_id
      }
      await nextTick()
      followUpForm.value?.clearValidate()
    } finally {
      loading.value = false
    }
  }
  async function saveFollowUp() {
    if (!record.value || saving.value || !(await followUpForm.value?.validate().catch(() => false)))
      return
    saving.value = true
    try {
      const saved = await request.post<AssessmentRecord>({
        url: '/app/core/adverse-reaction/follow-up',
        params: {
          id: record.value.id,
          revision: record.value.assessment_revision || 0,
          ...followUp.value
        },
        showSuccessMessage: true
      })
      record.value = { ...record.value, ...saved }
      followUp.value = {
        ...blankFollowUp(),
        processing_status: saved.processing_status || '待处理',
        owner_id: saved.owner_id ?? saved.assessment?.owner_id
      }
      await nextTick()
      followUpForm.value?.clearValidate()
      emit('saved')
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
  .section-heading,
  .history-heading,
  .history-title,
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

  .compact-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .quick-follow-up {
    max-width: 900px;
  }

  .section-heading {
    justify-content: space-between;
    margin-bottom: 18px;
  }

  .section-heading h3 {
    margin-bottom: 6px;
  }

  .section-heading .section-description {
    margin: 0;
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

  .form-grid :deep(.el-select) {
    width: 100%;
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

  .history-title {
    flex-wrap: wrap;
    gap: 8px;
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

  .footer-actions {
    flex-shrink: 0;
    gap: 8px;
  }

  .footer-actions :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  @media (width <= 640px) {
    .form-grid,
    .compact-grid,
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
    height: min(760px, 92vh);
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
