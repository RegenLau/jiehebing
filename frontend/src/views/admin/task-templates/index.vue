<template>
  <div class="template-page"
    ><div class="toolbar"
      ><h2>任务模板</h2><ElButton type="primary" @click="open()">新增模板</ElButton></div
    ><ElCard shadow="never"
      ><div class="toolbar"
        ><ElInput
          v-model="keyword"
          placeholder="模板名称"
          clearable
          @keyup.enter="search"
        /><ElSelect v-model="type" placeholder="全部类型" clearable @change="search"
          ><ElOption v-for="t in types" :key="t" :value="t" :label="t" /></ElSelect
        ><ElSelect v-model="status" placeholder="全部状态" clearable @change="search"
          ><ElOption label="启用" :value="1" /><ElOption label="停用" :value="0" /></ElSelect
        ><ElButton @click="search">查询</ElButton></div
      ><ElTable v-loading="loading" :data="rows" border
        ><ElTableColumn prop="name" label="模板名称" /><ElTableColumn
          prop="type"
          label="类型"
          width="100"
        /><ElTableColumn prop="requirements" label="提交要求" show-overflow-tooltip /><ElTableColumn
          prop="version"
          label="版本"
          width="100"
        /><ElTableColumn label="状态" width="90"
          ><template #default="{ row }">{{
            row.status === 1 ? '启用' : '停用'
          }}</template></ElTableColumn
        ><ElTableColumn label="操作" width="190"
          ><template #default="{ row }"
            ><ElButton link type="primary" @click="open(row.id, true)">详情</ElButton
            ><ElButton v-if="!row.system_kind" link type="primary" @click="open(row.id)"
              >编辑</ElButton
            ><ElButton
              v-if="!row.system_kind"
              link
              type="warning"
              @click="toggle(row as Template)"
              >{{ row.status === 1 ? '停用' : '启用' }}</ElButton
            ></template
          ></ElTableColumn
        ></ElTable
      ><ElPagination
        v-model:current-page="current"
        :total="total"
        :page-size="10"
        layout="total,prev,pager,next"
        @current-change="load"
    /></ElCard>
    <ElDialog
      v-model="visible"
      :title="readonly ? '模板详情' : form.id ? '编辑任务模板' : '新增任务模板'"
      width="720px"
      :close-on-click-modal="false"
      :before-close="close"
      ><ElForm label-position="top" :disabled="readonly || saving"
        ><ElFormItem label="模板名称（必填）"
          ><ElInput v-model="form.name" maxlength="100" /></ElFormItem
        ><ElFormItem label="任务类型"
          ><ElSelect v-model="form.type"
            ><ElOption v-for="t in types" :key="t" :value="t" :label="t" /></ElSelect></ElFormItem
        ><p v-if="form.type === '检查'" class="type-note"
          >检查任务已包含报告上传、患者确认和医护核对流程，无需另建报告提交任务。</p
        ><p v-else class="type-note">提醒任务无需上传报告，患者可直接确认完成。</p
        ><ElFormItem label="提交要求（必填）"
          ><ElInput v-model="form.requirements" type="textarea" maxlength="1000" /></ElFormItem
        ><ElFormItem v-if="form.id && !readonly" label="修改原因（必填）"
          ><ElInput v-model="form.reason" maxlength="300" /></ElFormItem></ElForm
      ><p>执行时间和频次在分组中设置。</p
      ><template v-if="readonly"
        ><h3>变更记录</h3
        ><ElTable :data="form.history || []"
          ><ElTableColumn prop="time" label="时间" /><ElTableColumn
            prop="operator"
            label="操作人"
          /><ElTableColumn prop="reason" label="原因" /><ElTableColumn type="expand"
            ><template #default="{ row }">
              <pre>修改前：{{ describe(row.before) }}\n修改后：{{ describe(row.after) }}</pre>
            </template></ElTableColumn
          ></ElTable
        ></template
      ><template #footer
        ><ElButton :disabled="saving" @click="visible = false">关闭</ElButton
        ><ElButton v-if="!readonly" type="primary" :loading="saving" @click="save"
          >保存模板</ElButton
        ></template
      ></ElDialog
    ></div
  >
</template>
<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import request from '@/utils/http'
  interface Template {
    id?: number
    name: string
    type: string
    description: string
    requirements: string
    status: number
    version?: string
    reason: string
    history?: { time: string; operator: string; reason: string; before: unknown; after: unknown }[]
    system_kind?: 'pickup'
  }
  function describe(value: unknown) {
    if (!value) return '新增前无记录'
    const r = value as Template
    return [
      r.name,
      '类型：' + r.type,
      '提交要求：' + r.requirements,
      '版本：' + r.version,
      '状态：' + (r.status === 1 ? '启用' : '停用')
    ].join('\n')
  }
  const types = ['提醒', '检查'],
    templateOrder = ['取药提醒', '血常规复查', '生化指标复查', '胸部 CT 复查'],
    blank = (): Template => ({
      name: '',
      type: '检查',
      description: '',
      requirements: '',
      status: 1,
      reason: ''
    })
  const rows = ref<Template[]>([]),
    form = ref(blank()),
    keyword = ref(''),
    type = ref(''),
    status = ref<number>(),
    current = ref(1),
    total = ref(0),
    loading = ref(false),
    visible = ref(false),
    readonly = ref(false),
    saving = ref(false)
  async function load() {
    loading.value = true
    try {
      const p = await request.get<{ list: Template[]; total: number }>({
        url: '/app/core/task-template/index',
        params: {
          keyword: keyword.value,
          type: type.value,
          status: status.value,
          current: current.value,
          size: 10
        }
      })
      rows.value = [...p.list].sort((a, b) => {
        const aIndex = templateOrder.indexOf(a.name)
        const bIndex = templateOrder.indexOf(b.name)
        if (aIndex === -1) return bIndex === -1 ? 0 : 1
        if (bIndex === -1) return -1
        return aIndex - bIndex
      })
      total.value = p.total
    } finally {
      loading.value = false
    }
  }
  function search() {
    current.value = 1
    void load()
  }
  async function open(id?: number, view = false) {
    readonly.value = view
    form.value = id
      ? {
          ...(await request.get<Template>({
            url: '/app/core/task-template/detail',
            params: { id }
          })),
          reason: ''
        }
      : blank()
    visible.value = true
  }
  async function save() {
    if (
      !form.value.name.trim() ||
      !form.value.requirements.trim() ||
      (form.value.id && !form.value.reason.trim())
    ) {
      ElMessage.warning('请填写名称、提交要求及修改原因')
      return
    }
    saving.value = true
    try {
      await request.post({
        url: '/app/core/task-template/save',
        params: form.value,
        showSuccessMessage: true
      })
      visible.value = false
      await load()
    } finally {
      saving.value = false
    }
  }
  async function toggle(row: Template) {
    try {
      const { value } = await ElMessageBox.prompt(
        '请填写变更原因，已有分组及任务不会自动改变。',
        '变更模板状态',
        { inputValidator: (v) => Boolean(v?.trim()) || '请填写原因' }
      )
      await request.post({
        url: '/app/core/task-template/status',
        params: {
          id: row.id,
          version: row.version,
          status: row.status === 1 ? 0 : 1,
          reason: value
        },
        showSuccessMessage: true
      })
      await load()
    } catch {
      /* 取消或请求错误 */
    }
  }
  function close(done: () => void) {
    if (!saving.value) done()
  }
  onMounted(load)
</script>
<style scoped>
  .template-page {
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
    width: 150px;
  }
  .el-pagination {
    margin-top: 20px;
  }

  .type-note {
    margin: -10px 0 18px;
    font-size: 13px;
    line-height: 1.6;
    color: #5f6b7a;
  }

  pre {
    white-space: pre-wrap;
    padding: 16px;
  }
</style>
