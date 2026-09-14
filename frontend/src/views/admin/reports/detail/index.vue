<template>
  <div v-loading="loading" class="detail-page">
    <header class="detail-header">
      <div class="detail-title">
        <ElButton text @click="goBack">← 返回报告列表</ElButton>
        <div v-if="form">
          <div class="title-line">
            <h2>{{ form.patient_name }}的{{ form.type }}</h2>
            <ElTag :type="statusTagType(form.status)" effect="light">{{ form.status }}</ElTag>
          </div>
          <p
            >检查日期 {{ form.exam_date
            }}<span v-if="form.task_id"> · 关联任务 #{{ form.task_id }}</span></p
          >
        </div>
      </div>
      <div v-if="form" class="detail-actions">
        <template v-if="form.status === '待核对'">
          <ElButton :disabled="saving" @click="discardChanges">舍弃未保存修改</ElButton>
          <ElButton :loading="saving" @click="review('需补充')">要求补充</ElButton>
          <ElButton type="primary" :loading="saving" @click="review('已核对')">核对通过</ElButton>
        </template>
        <ElButton
          v-else-if="form.status === '需补充'"
          type="primary"
          plain
          @click="scrollToSupplement"
        >
          补传报告资料
        </ElButton>
      </div>
    </header>

    <template v-if="form">
      <section class="report-summary-bar">
        <div class="summary-copy">
          <strong>OCR 解析概览</strong>
          <span
            >{{ form.ocr_result?.engine || '本地 Mock OCR' }} ·
            {{ form.ocr_result?.extracted_at || '待解析' }}</span
          >
        </div>
        <div class="summary-stats">
          <div
            ><strong>{{ ocrSummary.file_count }}</strong
            ><span>原始文件</span></div
          >
          <div
            ><strong>{{ ocrSummary.field_count }}</strong
            ><span>解析数据</span></div
          >
          <div
            ><strong>{{ ocrSummary.metric_count }}</strong
            ><span>检验项目</span></div
          >
          <div class="abnormal-stat"
            ><strong>{{ ocrSummary.abnormal_count }}</strong
            ><span>异常项</span></div
          >
        </div>
      </section>

      <div class="detail-workbench">
        <aside class="source-panel">
          <div class="panel-heading">
            <div>
              <h3>报告原文件</h3>
              <p>支持放大查看图片，PDF 可直接预览</p>
            </div>
            <ElTag effect="plain">{{ form.versions.length }} 次资料</ElTag>
          </div>

          <ElTabs v-model="activeVersion" class="version-tabs" @tab-change="resetActiveFile">
            <ElTabPane
              v-for="(version, versionIndex) in form.versions"
              :key="versionIndex"
              :label="`第 ${versionIndex + 1} 次上传`"
              :name="String(versionIndex)"
            />
          </ElTabs>

          <div v-if="selectedVersion" class="version-meta">
            <span>{{ selectedVersion.time }}</span>
            <span>{{ selectedVersion.operator || '-' }}</span>
            <p v-if="selectedVersion.note">{{ selectedVersion.note }}</p>
          </div>

          <div v-if="selectedVersion?.files.length" class="file-viewer">
            <div v-if="selectedVersion.files.length > 1" class="file-switcher">
              <button
                v-for="(file, fileIndex) in selectedVersion.files"
                :key="file.url"
                type="button"
                :class="{ active: activeFile === fileIndex }"
                @click="activeFile = fileIndex"
              >
                {{ fileIndex + 1 }}. {{ file.name }}
              </button>
            </div>
            <template v-if="selectedFile">
              <ElImage
                v-if="selectedFile.type.startsWith('image/')"
                class="source-image"
                :src="selectedFile.url"
                :preview-src-list="selectedVersion.files.filter(isImage).map((file) => file.url)"
                fit="contain"
                preview-teleported
              />
              <iframe
                v-else
                class="source-pdf"
                :src="selectedFile.url"
                :title="selectedFile.name"
              />
              <a class="open-source" :href="selectedFile.url" target="_blank" rel="noopener">
                在新窗口打开 {{ selectedFile.name }}
              </a>
            </template>
          </div>
          <ElEmpty v-else description="暂无报告文件" />
        </aside>

        <main class="parsed-panel">
          <div class="panel-heading">
            <div>
              <h3>OCR 解析数据</h3>
              <p>按报告原文件保留全部可视信息</p>
            </div>
            <ElTag
              :type="form.ocr_result?.status === 'completed' ? 'success' : 'warning'"
              effect="light"
            >
              {{ form.ocr_result?.status_text || '待人工核对' }}
            </ElTag>
          </div>

          <ElAlert
            :title="
              form.ocr_result?.notice || '本地演示未生成可用的 OCR 结果，请根据原文件人工补充。'
            "
            type="warning"
            :closable="false"
            show-icon
          />

          <section
            v-for="section in form.ocr_result?.sections || []"
            :key="section.key"
            class="data-section"
          >
            <h4>{{ section.title }}</h4>
            <dl class="field-grid">
              <div v-for="field in section.fields" :key="field.label">
                <dt>{{ field.label }}</dt>
                <dd>{{ field.value || '-' }}</dd>
              </div>
            </dl>
          </section>

          <section v-if="form.ocr_result?.findings.length" class="data-section">
            <h4>OCR 原始文字结论</h4>
            <dl class="finding-list">
              <div v-for="finding in form.ocr_result.findings" :key="finding.label">
                <dt>{{ finding.label }}</dt>
                <dd>{{ finding.value }}</dd>
              </div>
            </dl>
          </section>

          <section v-if="form.status === '待核对'" class="data-section review-fields-section">
            <div class="section-title-row">
              <div>
                <h4>人工核对基础字段与文字结论</h4>
                <p>原始 OCR 内容保留在上方；这里保存核对后的正式值。</p>
              </div>
            </div>
            <div class="review-base-grid">
              <label>
                <span>报告类型</span>
                <ElInput v-model="reviewType" />
              </label>
              <label>
                <span>检查日期</span>
                <ElDatePicker v-model="reviewExamDate" value-format="YYYY-MM-DD" />
              </label>
            </div>
            <div v-if="reviewFindings.length" class="review-findings">
              <label v-for="(finding, index) in reviewFindings" :key="index">
                <span>{{ finding.label }}</span>
                <ElInput v-model="finding.value" type="textarea" :rows="3" />
              </label>
            </div>
          </section>

          <section v-else-if="form.reviewed_data" class="data-section reviewed-result-section">
            <div class="section-title-row">
              <div>
                <h4>人工核对后的正式结果</h4>
                <p>
                  {{ form.reviewed_data.reviewed_by || '-' }} ·
                  {{ form.reviewed_data.reviewed_at || '时间未记录' }}
                </p>
              </div>
              <ElTag type="success" effect="light">已生效</ElTag>
            </div>
            <dl class="field-grid reviewed-base-grid">
              <div>
                <dt>报告类型</dt>
                <dd>{{ form.reviewed_data.type }}</dd>
              </div>
              <div>
                <dt>检查日期</dt>
                <dd>{{ form.reviewed_data.exam_date }}</dd>
              </div>
            </dl>
            <dl v-if="form.reviewed_data.findings.length" class="finding-list reviewed-findings-list">
              <div v-for="finding in form.reviewed_data.findings" :key="finding.label">
                <dt>{{ finding.label }}</dt>
                <dd>{{ finding.value }}</dd>
              </div>
            </dl>
          </section>

          <section class="data-section metric-section">
            <div class="section-title-row">
              <div>
                <h4>{{ form.status === '待核对' ? '人工核对检验项目' : '人工核对值' }}</h4>
                <p v-if="form.status === '待核对'">可纠正、补录或删除误识别项目；OCR 原始值仍单独保留。</p>
              </div>
              <span>{{ form.metrics.length }} 项</span>
            </div>
            <ElTable
              v-if="form.metrics.length"
              class="metric-table"
              :data="form.metrics"
              table-layout="fixed"
              border
            >
              <ElTableColumn label="项目" min-width="140">
                <template #default="{ row }"
                  ><ElInput v-model="row.name" :disabled="form.status !== '待核对'"
                /></template>
              </ElTableColumn>
              <ElTableColumn label="检测值" min-width="90">
                <template #default="{ row }"
                  ><ElInput v-model="row.value" :disabled="form.status !== '待核对'"
                /></template>
              </ElTableColumn>
              <ElTableColumn label="单位" min-width="90">
                <template #default="{ row }"
                  ><ElInput v-model="row.unit" :disabled="form.status !== '待核对'"
                /></template>
              </ElTableColumn>
              <ElTableColumn label="参考范围" min-width="110">
                <template #default="{ row }"
                  ><ElInput v-model="row.reference" :disabled="form.status !== '待核对'"
                /></template>
              </ElTableColumn>
              <ElTableColumn label="异常标识" min-width="100">
                <template #default="{ row }">
                  <ElSelect
                    v-model="row.flag"
                    placeholder="未标记"
                    :disabled="form.status !== '待核对'"
                  >
                    <ElOption label="未标记" value="" />
                    <ElOption label="偏低" value="偏低" />
                    <ElOption label="偏高" value="偏高" />
                    <ElOption label="异常" value="异常" />
                  </ElSelect>
                </template>
              </ElTableColumn>
              <ElTableColumn v-if="form.status === '待核对'" label="操作" width="76">
                <template #default="{ $index }">
                  <ElButton link type="danger" @click="removeMetric($index)">删除</ElButton>
                </template>
              </ElTableColumn>
            </ElTable>
            <ElEmpty
              v-else
              :description="
                reviewFindings.length
                  ? '该类型以文字所见和结论核对为主，无数值检验项目'
                  : '未识别出数值项目，可人工添加；也可直接要求补充资料'
              "
              :image-size="72"
            />
            <ElButton
              v-if="form.status === '待核对'"
              class="add-metric-button"
              @click="form.metrics.push({ name: '', value: '', unit: '', reference: '', flag: '' })"
            >
              添加检验项目
            </ElButton>
          </section>

          <section v-if="form.status === '待核对'" class="data-section review-section">
            <h4>人工核对说明</h4>
            <ElInput
              v-model="reason"
              type="textarea"
              :rows="3"
              placeholder="请填写核对结论，要求补充时说明具体原因"
            />
            <ElInput
              v-model="supplementRequirements"
              type="textarea"
              :rows="2"
              class="supplement-requirements"
              placeholder="要求补充时必填：明确需要补哪份资料或哪个项目"
            />
          </section>

          <section class="data-section">
            <h4>核对记录</h4>
            <ElTimeline v-if="form.history.length">
              <ElTimelineItem
                v-for="(history, index) in [...form.history].reverse()"
                :key="index"
                :timestamp="history.time"
                placement="top"
              >
                <strong>{{ history.operator }}</strong>
                <p>{{ history.reason }}</p>
                <p v-if="history.supplement_requirements">
                  需补充：{{ history.supplement_requirements }}
                </p>
              </ElTimelineItem>
            </ElTimeline>
            <ElEmpty v-else description="暂无核对记录" :image-size="64" />
          </section>
        </main>
      </div>

      <section v-if="form.status === '需补充'" ref="supplementSection" class="supplement-panel">
        <div>
          <h3>补传报告资料</h3>
          <p>补传后将重新生成 OCR 结构化数据，并进入待核对状态。</p>
        </div>
        <label class="supplement-field">
          <span>报告图片 / PDF</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,application/pdf"
            multiple
            :disabled="saving"
            @change="upload"
          />
          <small>已上传 {{ uploads.length }} 份</small>
        </label>
        <label class="supplement-field">
          <span>补传说明</span>
          <ElInput v-model="note" type="textarea" :rows="3" placeholder="请说明本次补充的资料" />
        </label>
        <ElButton type="primary" :loading="saving" @click="saveSupplement">提交补传资料</ElButton>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import request from '@/utils/http'

  interface ReportFile {
    url: string
    name: string
    type: string
  }
  interface ReportMetric {
    name: string
    value: string
    unit: string
    reference: string
    flag: string
  }
  interface OcrResult {
    status: string
    status_text: string
    extracted_at: string
    engine: string
    notice: string
    sections: { key: string; title: string; fields: { label: string; value: string }[] }[]
    findings: { label: string; value: string }[]
    summary: {
      file_count: number
      field_count: number
      metric_count: number
      abnormal_count: number
    }
  }
  interface Report {
    id: number
    task_id?: number
    patient_name: string
    type: string
    exam_date: string
    status: string
    ocr_result?: OcrResult | null
    metrics: ReportMetric[]
    versions: { time: string; note: string; operator?: string; files: ReportFile[] }[]
    reviewed_data?: {
      type: string
      exam_date: string
      findings: { label: string; value: string }[]
      reviewed_by?: string
      reviewed_at?: string
    } | null
    history: {
      time: string
      operator: string
      reason: string
      supplement_requirements?: string
    }[]
  }

  const route = useRoute()
  const router = useRouter()
  const form = ref<Report | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const uploads = ref<string[]>([])
  const note = ref('')
  const reason = ref('')
  const supplementRequirements = ref('')
  const reviewType = ref('')
  const reviewExamDate = ref('')
  const reviewFindings = ref<{ label: string; value: string }[]>([])
  const activeVersion = ref('0')
  const activeFile = ref(0)
  const supplementSection = ref<HTMLElement>()
  const selectedVersion = computed(() => form.value?.versions[Number(activeVersion.value)])
  const selectedFile = computed(() => selectedVersion.value?.files[activeFile.value])
  const ocrSummary = computed(
    () =>
      form.value?.ocr_result?.summary || {
        file_count: form.value?.versions.flatMap((version) => version.files).length || 0,
        field_count: form.value?.metrics.length || 0,
        metric_count: form.value?.metrics.length || 0,
        abnormal_count: form.value?.metrics.filter((metric) => metric.flag).length || 0
      }
  )

  function statusTagType(value: string) {
    if (value === '已核对') return 'success'
    if (value === '需补充') return 'danger'
    return 'warning'
  }
  function isImage(file: ReportFile) {
    return file.type.startsWith('image/')
  }
  function resetActiveFile() {
    activeFile.value = 0
  }
  function goBack() {
    void router.push('/reports/index')
  }
  function scrollToSupplement() {
    supplementSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  async function load() {
    loading.value = true
    try {
      form.value = await request.get<Report>({
        url: '/app/core/report/detail',
        params: { id: route.params.id }
      })
      activeVersion.value = String(Math.max(0, form.value.versions.length - 1))
      activeFile.value = 0
      uploads.value = []
      note.value = ''
      reason.value = ''
      supplementRequirements.value = ''
      reviewType.value = form.value.reviewed_data?.type || form.value.type
      reviewExamDate.value = form.value.reviewed_data?.exam_date || form.value.exam_date
      reviewFindings.value = (
        form.value.reviewed_data?.findings ||
        form.value.ocr_result?.findings ||
        []
      ).map((finding) => ({ label: finding.label, value: finding.value }))
    } finally {
      loading.value = false
    }
  }
  async function upload(event: Event) {
    saving.value = true
    try {
      for (const file of Array.from((event.target as HTMLInputElement).files || [])) {
        const data = new FormData()
        data.append('file', file)
        const result = await request.post<{ url: string }>({
          url: '/app/core/file/upload-file',
          params: data
        })
        uploads.value.push(result.url)
      }
    } finally {
      ;(event.target as HTMLInputElement).value = ''
      saving.value = false
    }
  }
  async function saveSupplement() {
    if (!form.value) return
    saving.value = true
    try {
      await request.post({
        url: '/app/core/report/supplement',
        params: { id: form.value.id, files: uploads.value, note: note.value },
        showSuccessMessage: true
      })
      await load()
    } finally {
      saving.value = false
    }
  }
  function removeMetric(index: number) {
    form.value?.metrics.splice(index, 1)
  }
  function discardChanges() {
    void load()
  }
  async function review(nextStatus: string) {
    if (!form.value) return
    if (!reason.value.trim()) return ElMessage.warning('请填写人工核对说明')
    if (nextStatus === '需补充' && !supplementRequirements.value.trim())
      return ElMessage.warning('请明确填写需要补充的资料或项目')
    saving.value = true
    try {
      await request.post({
        url: '/app/core/report/review',
        params: {
          id: form.value.id,
          status: nextStatus,
          reason: reason.value,
          supplement_requirements: supplementRequirements.value,
          type: reviewType.value,
          exam_date: reviewExamDate.value,
          findings: reviewFindings.value,
          metrics: form.value.metrics
        },
        showSuccessMessage: true
      })
      await load()
    } finally {
      saving.value = false
    }
  }

  watch(() => route.params.id, load, { immediate: true })
</script>

<style scoped>
  .detail-page {
    min-height: 70vh;
    padding: 20px;
  }
  .detail-header {
    position: sticky;
    top: 0;
    z-index: 8;
    display: flex;
    gap: 20px;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 18px;
    padding: 10px 0;
    background: var(--el-bg-color-page);
  }
  .detail-title > .el-button {
    margin: 0 0 8px -15px;
  }
  .title-line {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }
  .title-line h2,
  .detail-title p,
  .panel-heading h3,
  .panel-heading p,
  .summary-copy strong,
  .summary-copy span,
  .section-title-row h4,
  .section-title-row p,
  .supplement-panel h3,
  .supplement-panel p {
    margin: 0;
  }
  .title-line h2 {
    color: var(--el-text-color-primary);
    font-size: 22px;
  }
  .detail-title p,
  .panel-heading p,
  .section-title-row p,
  .supplement-panel p {
    margin-top: 6px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
  .detail-actions {
    display: flex;
    flex: none;
    gap: 10px;
  }
  .report-summary-bar {
    display: flex;
    gap: 20px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding: 16px 18px;
    border: 1px solid #dce8f2;
    border-radius: 12px;
    background: linear-gradient(135deg, #f7fbff 0%, #f2f7fb 100%);
  }
  .summary-copy {
    display: grid;
    gap: 5px;
  }
  .summary-copy strong {
    color: var(--el-text-color-primary);
    font-size: 16px;
  }
  .summary-copy span {
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
  .summary-stats {
    display: flex;
    flex: none;
    gap: 8px;
  }
  .summary-stats div {
    display: grid;
    min-width: 88px;
    padding: 9px 12px;
    border-radius: 8px;
    background: rgb(255 255 255 / 80%);
    text-align: center;
  }
  .summary-stats strong {
    color: #245e8c;
    font-size: 19px;
  }
  .summary-stats span {
    margin-top: 2px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
  .summary-stats .abnormal-stat strong {
    color: var(--el-color-danger);
  }
  .detail-workbench {
    display: grid;
    grid-template-columns: minmax(360px, 0.75fr) minmax(580px, 1.35fr);
    align-items: start;
    overflow: hidden;
    border: 1px solid var(--el-border-color-light);
    border-radius: 12px;
    background: var(--el-bg-color);
  }
  .source-panel,
  .parsed-panel {
    min-width: 0;
    padding: 18px;
  }
  .source-panel {
    position: sticky;
    top: 16px;
    border-right: 1px solid var(--el-border-color-light);
    background: #f3f6f9;
  }
  .parsed-panel {
    display: grid;
    align-content: start;
    gap: 16px;
  }
  .panel-heading,
  .section-title-row {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    justify-content: space-between;
  }
  .panel-heading h3 {
    color: var(--el-text-color-primary);
    font-size: 17px;
  }
  .version-tabs {
    margin-top: 12px;
  }
  .version-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-bottom: 12px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
  .version-meta p {
    width: 100%;
    margin: 0;
    padding: 8px 10px;
    border-radius: 6px;
    background: var(--el-bg-color);
    color: var(--el-text-color-regular);
  }
  .file-viewer {
    display: grid;
    gap: 12px;
  }
  .file-switcher {
    display: flex;
    gap: 8px;
    overflow-x: auto;
  }
  .file-switcher button {
    max-width: 190px;
    padding: 7px 10px;
    overflow: hidden;
    border: 1px solid var(--el-border-color);
    border-radius: 6px;
    background: var(--el-bg-color);
    color: var(--el-text-color-regular);
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }
  .file-switcher button.active {
    border-color: var(--el-color-primary);
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }
  .source-image,
  .source-pdf {
    width: 100%;
    height: min(66vh, 760px);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: #dfe5eb;
  }
  .source-pdf {
    display: block;
  }
  .open-source {
    justify-self: center;
    color: var(--el-color-primary);
    font-size: 13px;
  }
  .data-section {
    padding: 16px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
    background: var(--el-bg-color);
  }
  .data-section h4 {
    margin: 0 0 13px;
    color: var(--el-text-color-primary);
    font-size: 15px;
  }
  .field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1px;
    margin: 0;
    overflow: hidden;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: var(--el-border-color-lighter);
  }
  .field-grid div {
    display: grid;
    grid-template-columns: minmax(90px, 0.42fr) minmax(0, 1fr);
    min-width: 0;
    background: var(--el-bg-color);
  }
  .field-grid dt,
  .field-grid dd {
    min-width: 0;
    margin: 0;
    padding: 10px 12px;
    overflow-wrap: anywhere;
  }
  .field-grid dt {
    background: var(--el-fill-color-extra-light);
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
  .field-grid dd {
    color: var(--el-text-color-primary);
    font-size: 13px;
  }
  .finding-list {
    display: grid;
    gap: 12px;
    margin: 0;
  }
  .finding-list div {
    display: grid;
    gap: 6px;
  }
  .finding-list dt {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    font-weight: 600;
  }
  .finding-list dd {
    margin: 0;
    color: var(--el-text-color-primary);
    line-height: 1.7;
  }
  .section-title-row {
    margin-bottom: 13px;
  }
  .section-title-row h4 {
    margin-bottom: 0;
  }
  .section-title-row > span {
    flex: none;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
  .metric-section {
    min-width: 0;
  }
  .metric-table {
    width: 100%;
  }
  .metric-table :deep(.el-table__inner-wrapper),
  .metric-table :deep(.el-table__body-wrapper),
  .metric-table :deep(.el-scrollbar),
  .metric-table :deep(.el-scrollbar__wrap) {
    max-width: 100%;
  }
  .metric-section :deep(.el-input.is-disabled .el-input__wrapper),
  .metric-section :deep(.el-select__wrapper.is-disabled) {
    background: transparent;
    box-shadow: none;
  }
  .metric-section :deep(.el-input.is-disabled .el-input__inner),
  .metric-section :deep(.el-select__wrapper.is-disabled .el-select__selected-item) {
    color: var(--el-text-color-primary);
    -webkit-text-fill-color: var(--el-text-color-primary);
  }
  .add-metric-button {
    margin-top: 12px;
  }
  .review-base-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  .review-base-grid label,
  .review-findings label {
    display: grid;
    gap: 7px;
    color: var(--el-text-color-regular);
    font-size: 13px;
    font-weight: 600;
  }
  .review-findings {
    display: grid;
    gap: 14px;
    margin-top: 14px;
  }
  .supplement-requirements {
    margin-top: 10px;
  }
  .data-section :deep(.el-timeline) {
    margin: 4px 0 0;
    padding-left: 6px;
  }
  .data-section :deep(.el-timeline-item__content p) {
    margin: 5px 0 0;
    color: var(--el-text-color-regular);
  }
  .supplement-panel {
    display: grid;
    grid-template-columns: minmax(260px, 1fr) minmax(220px, 0.8fr) minmax(280px, 1fr) auto;
    gap: 18px;
    align-items: end;
    margin-top: 16px;
    padding: 18px;
    border: 1px dashed var(--el-border-color);
    border-radius: 10px;
    background: var(--el-fill-color-extra-light);
    scroll-margin-top: 20px;
  }
  .supplement-field {
    display: grid;
    gap: 8px;
    color: var(--el-text-color-regular);
    font-size: 13px;
    font-weight: 600;
  }
  .supplement-field small {
    color: var(--el-text-color-secondary);
    font-weight: 400;
  }
  @media (max-width: 1240px) {
    .detail-workbench {
      grid-template-columns: 1fr;
    }
    .source-panel {
      position: static;
      border-right: 0;
      border-bottom: 1px solid var(--el-border-color-light);
    }
    .source-image,
    .source-pdf {
      height: 560px;
    }
    .supplement-panel {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 760px) {
    .detail-page {
      padding: 12px;
    }
    .detail-header,
    .report-summary-bar {
      align-items: stretch;
      flex-direction: column;
    }
    .detail-actions .el-button {
      flex: 1;
    }
    .summary-stats {
      width: 100%;
      overflow-x: auto;
    }
    .summary-stats div {
      flex: 1;
      min-width: 80px;
    }
    .source-panel,
    .parsed-panel {
      padding: 12px;
    }
    .source-image,
    .source-pdf {
      height: 420px;
    }
    .field-grid,
    .supplement-panel {
      grid-template-columns: 1fr;
    }
  }
</style>
