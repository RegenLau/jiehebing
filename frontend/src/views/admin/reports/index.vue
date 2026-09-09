<template>
  <div class="page"
    ><div class="toolbar"
      ><h2>检查报告</h2
      ><ResearchExport
        kind="reports"
        :params="{ keyword, status: status || route.query.status, user_id: route.query.user_id }"
      /><ElButton type="primary" @click="create">代录报告</ElButton></div
    ><ElCard shadow="never"
      ><div class="toolbar"
        ><ElInput
          v-model="keyword"
          placeholder="患者或报告类型"
          clearable
          @keyup.enter="search"
        /><ElSelect v-model="status" placeholder="全部状态" clearable @change="search"
          ><ElOption
            v-for="s in ['待核对', '需补充', '已核对']"
            :key="s"
            :label="s"
            :value="s" /></ElSelect
        ><ElButton @click="search">查询</ElButton></div
      ><ElTable v-loading="loading" :data="rows" border
        ><ElTableColumn prop="patient_name" label="患者" /><ElTableColumn
          prop="type"
          label="报告类型"
        /><ElTableColumn prop="exam_date" label="检查日期" /><ElTableColumn
          prop="status"
          label="状态"
        /><ElTableColumn label="操作"
          ><template #default="{ row }"
            ><ElButton link type="primary" @click="open(row.id)">详情/核对</ElButton></template
          ></ElTableColumn
        ></ElTable
      ><ElPagination
        v-model:current-page="current"
        :page-size="10"
        :total="total"
        layout="total,prev,pager,next"
        @current-change="load"
    /></ElCard>
    <ElDialog
      v-model="visible"
      :title="form.id ? '报告详情' : '代录报告'"
      width="900px"
      :before-close="close"
      :close-on-click-modal="false"
      ><ElAlert
        title="当前报告指标由人工录入；OCR 尚未接入。已核对不代表检查结果正常。"
        type="info"
        :closable="false"
      /><ElForm label-position="top" :disabled="saving"
        ><template v-if="!form.id"
          ><ElFormItem label="患者"
            ><ElSelect v-model="form.user_id" filterable @change="patientChanged"
              ><ElOption
                v-for="p in patients"
                :key="p.id"
                :label="p.name + ' · ' + p.mobile"
                :value="p.id" /></ElSelect></ElFormItem
          ><ElFormItem label="关联任务（可选）"
            ><ElSelect v-model="form.task_id" clearable
              ><ElOption
                v-for="t in tasks"
                :key="t.id"
                :label="t.name + ' · ' + t.date"
                :value="t.id" /></ElSelect></ElFormItem
          ><ElFormItem label="报告类型"><ElInput v-model="form.type" /></ElFormItem
          ><ElFormItem label="检查日期"
            ><ElDatePicker
              v-model="form.exam_date"
              value-format="YYYY-MM-DD" /></ElFormItem></template
        ><template v-else
          ><p
            >{{ form.patient_name }} · {{ form.type }} · {{ form.exam_date }} · {{ form.status }}</p
          ><div v-for="(v, i) in form.versions" :key="i"
            ><h4>第 {{ i + 1 }} 次资料 · {{ v.time }}</h4
            ><p>{{ v.note }}</p
            ><div class="files"
              ><template v-for="f in v.files" :key="f.url"
                ><ElImage
                  v-if="f.type.startsWith('image/')"
                  :src="f.url"
                  :preview-src-list="[f.url]"
                  fit="contain"
                /><a v-else :href="f.url" target="_blank" rel="noopener"
                  >{{ f.name }}（PDF）</a
                ></template
              ></div
            ></div
          ></template
        >
        <template v-if="!form.id || form.status === '需补充'"
          ><ElFormItem label="上传报告图片/PDF"
            ><input
              type="file"
              accept="image/png,image/jpeg,image/gif,application/pdf"
              multiple
              :disabled="saving"
              @change="upload" /></ElFormItem
          ><p>本次已上传 {{ uploads.length }} 份</p
          ><ElFormItem label="补充说明"><ElInput v-model="note" type="textarea" /></ElFormItem
        ></template>
        <template v-if="form.id"
          ><h3>人工核对指标</h3
          ><ElTable :data="form.metrics"
            ><ElTableColumn label="项目"
              ><template #default="{ row }"
                ><ElInput
                  v-model="row.name"
                  :disabled="form.status !== '待核对'" /></template></ElTableColumn
            ><ElTableColumn label="检测值"
              ><template #default="{ row }"
                ><ElInput
                  v-model="row.value"
                  :disabled="form.status !== '待核对'" /></template></ElTableColumn
            ><ElTableColumn label="单位"
              ><template #default="{ row }"
                ><ElInput
                  v-model="row.unit"
                  :disabled="form.status !== '待核对'" /></template></ElTableColumn
            ><ElTableColumn label="参考范围"
              ><template #default="{ row }"
                ><ElInput
                  v-model="row.reference"
                  :disabled="form.status !== '待核对'" /></template></ElTableColumn></ElTable
          ><ElButton
            v-if="form.status === '待核对'"
            @click="form.metrics.push({ name: '', value: '', unit: '', reference: '' })"
            >添加指标</ElButton
          ><ElFormItem v-if="form.status === '待核对'" label="核对说明/补充原因"
            ><ElInput v-model="reason" type="textarea" /></ElFormItem
          ><h3>核对记录</h3
          ><ElTable :data="form.history"
            ><ElTableColumn prop="time" label="时间" /><ElTableColumn
              prop="operator"
              label="核对人" /><ElTableColumn
              prop="reason"
              label="说明" /></ElTable></template></ElForm
      ><template #footer
        ><ElButton :disabled="saving" @click="visible = false">关闭</ElButton
        ><ElButton
          v-if="!form.id || form.status === '需补充'"
          type="primary"
          :loading="saving"
          @click="saveUpload"
          >提交资料</ElButton
        ><template v-if="form.status === '待核对'"
          ><ElButton :loading="saving" @click="review('需补充')">要求补充</ElButton
          ><ElButton type="primary" :loading="saving" @click="review('已核对')"
            >核对通过</ElButton
          ></template
        ></template
      ></ElDialog
    ></div
  >
</template>
<script setup lang="ts">
  import ResearchExport from '@/components/business/research-export/index.vue'

  import { ref, onMounted, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import request from '@/utils/http'
  import { fetchPatientList, type PatientRecord } from '@/api/patient'
  interface Report {
    id?: number
    user_id?: number
    task_id?: number
    patient_name?: string
    type: string
    exam_date: string
    status: string
    metrics: { name: string; value: string; unit: string; reference: string }[]
    versions: { time: string; note: string; files: { url: string; name: string; type: string }[] }[]
    history: { time: string; operator: string; reason: string }[]
  }
  const blank = (): Report => ({
      type: '',
      exam_date: '',
      status: '',
      metrics: [],
      versions: [],
      history: []
    }),
    route = useRoute(),
    form = ref(blank()),
    rows = ref<Report[]>([]),
    patients = ref<PatientRecord[]>([]),
    tasks = ref<{ id: number; name: string; type: string; date: string; status: string }[]>([]),
    keyword = ref(''),
    status = ref(''),
    current = ref(1),
    total = ref(0),
    loading = ref(false),
    saving = ref(false),
    visible = ref(false),
    uploads = ref<string[]>([]),
    note = ref(''),
    reason = ref('')
  async function load() {
    loading.value = true
    try {
      const p = await request.get<{ list: Report[]; total: number }>({
        url: '/app/core/report/index',
        params: {
          keyword: keyword.value,
          status: status.value || route.query.status,
          user_id: route.query.user_id,
          current: current.value,
          size: 10
        }
      })
      rows.value = p.list
      total.value = p.total
    } finally {
      loading.value = false
    }
  }
  function search() {
    current.value = 1
    void load()
  }
  async function create() {
    form.value = blank()
    uploads.value = []
    note.value = ''
    tasks.value = []
    const all: PatientRecord[] = []
    let n = 1
    while (true) {
      const p = await fetchPatientList({ current: n++, size: 100 })
      all.push(...p.list)
      if (all.length >= p.total) break
    }
    patients.value = all
    visible.value = true
  }
  async function patientChanged() {
    form.value.task_id = undefined
    const all: typeof tasks.value = []
    let n = 1
    while (true) {
      const p = await request.get<{ list: typeof tasks.value; total: number }>({
        url: '/app/core/followup/index',
        params: { user_id: form.value.user_id, current: n++, size: 100 }
      })
      all.push(...p.list)
      if (all.length >= p.total) break
    }
    tasks.value = all.filter(
      (t) => ['检查', '报告提交'].includes(t.type) && !['已完成', '已取消'].includes(t.status)
    )
  }
  async function open(id: number) {
    form.value = await request.get({ url: '/app/core/report/detail', params: { id } })
    uploads.value = []
    note.value = ''
    reason.value = ''
    visible.value = true
  }
  async function upload(e: Event) {
    saving.value = true
    try {
      for (const file of Array.from((e.target as HTMLInputElement).files || [])) {
        const data = new FormData()
        data.append('file', file)
        const result = await request.post<{ url: string }>({
          url: '/app/core/file/upload-file',
          params: data
        })
        uploads.value.push(result.url)
      }
    } finally {
      saving.value = false
    }
  }
  async function saveUpload() {
    saving.value = true
    try {
      await request.post({
        url: '/app/core/report/' + (form.value.id ? 'supplement' : 'create'),
        params: { ...form.value, files: uploads.value, note: note.value },
        showSuccessMessage: true
      })
      visible.value = false
      await load()
    } finally {
      saving.value = false
    }
  }
  async function review(status: string) {
    saving.value = true
    try {
      await request.post({
        url: '/app/core/report/review',
        params: { id: form.value.id, status, reason: reason.value, metrics: form.value.metrics },
        showSuccessMessage: true
      })
      visible.value = false
      await load()
    } finally {
      saving.value = false
    }
  }
  function close(done: () => void) {
    if (!saving.value) done()
  }
  watch(
    () => route.fullPath,
    () => {
      current.value = 1
      status.value = ''
      void load()
    }
  )
  onMounted(load)
</script>
<style scoped>
  .page {
    padding: 20px;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }
  .toolbar h2 {
    flex: 1;
  }
  .toolbar .el-input {
    max-width: 260px;
  }
  .toolbar .el-select {
    width: 160px;
  }
  .el-pagination {
    margin-top: 20px;
  }
  .files {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }
  .files .el-image {
    width: 160px;
    height: 160px;
  }
</style>
