<template>
  <div class="page" :class="{ embedded }"
    ><div class="toolbar"
      ><h2 v-if="!embedded">每日反馈记录</h2
      ><ResearchExport
        kind="feedback"
        :params="{
          keyword,
          date,
          user_id: effectiveUserId || undefined,
          project_id: projectId,
          group_id: groupId,
          start_date: dateRange[0],
          end_date: dateRange[1]
        }"
      /><ElButton type="primary" @click="create">代录反馈</ElButton></div
    ><ElCard shadow="never">
      <ResearchScopeFilter
        v-if="!embedded"
        v-model:project-id="projectId"
        v-model:group-id="groupId"
        v-model:date-range="dateRange"
        @change="search" />
      <div class="toolbar"
        ><ElInput
          v-if="!embedded"
          v-model="keyword"
          placeholder="患者姓名"
          clearable
          @keyup.enter="search"
        /><ElDatePicker v-model="date" value-format="YYYY-MM-DD" @change="search" /><ElButton
          @click="search"
          >查询</ElButton
        ></div
      ><ElTable :data="rows" v-loading="loading" border
        ><ElTableColumn prop="patient_name" label="患者" /><ElTableColumn
          prop="date"
          label="反馈日期" /><ElTableColumn label="症状变化" min-width="230"
          ><template #default="{ row }">{{
            row.no_discomfort
              ? '无不适'
              : row.symptoms.map((s: Symptom) => `${s.name}：${s.change}`).join('、')
          }}</template></ElTableColumn
        ><ElTableColumn prop="note" label="补充说明" /><ElTableColumn
          prop="source"
          label="来源" /></ElTable
      ><ElPagination
        v-model:current-page="current"
        :page-size="10"
        :total="total"
        layout="total,prev,pager,next"
        @current-change="load" /></ElCard
    ><ElDialog
      v-model="visible"
      title="后台代录每日反馈"
      width="760px"
      :before-close="close"
      :close-on-click-modal="false"
      ><ElForm label-position="top" :disabled="saving"
        ><ElFormItem label="患者"
          ><ElSelect v-model="form.user_id" filterable :disabled="Boolean(effectiveUserId)"
            ><ElOption
              v-for="p in patients"
              :key="p.id"
              :label="p.name + ' · ' + p.mobile"
              :value="p.id" /></ElSelect></ElFormItem
        ><ElFormItem label="反馈日期"
          ><ElDatePicker v-model="form.date" value-format="YYYY-MM-DD" /></ElFormItem
        ><ElCheckbox v-model="form.no_discomfort" @change="form.symptoms = []">无不适</ElCheckbox
        ><template v-if="!form.no_discomfort"
          ><div v-for="(s, i) in form.symptoms" :key="i" class="toolbar"
            ><ElSelect v-model="s.name" placeholder="症状"
              ><ElOption v-for="name in names" :key="name" :value="name" :label="name" /></ElSelect
            ><ElSelect v-model="s.change" placeholder="变化"
              ><ElOption v-for="c in changes" :key="c" :label="c" :value="c" /></ElSelect
            ><ElButton @click="form.symptoms.splice(i, 1)">移除</ElButton></div
          ><ElButton @click="form.symptoms.push({ name: '', change: '' })"
            >添加症状</ElButton
          ></template
        ><ElFormItem label="补充说明"
          ><ElInput
            v-model="form.note"
            type="textarea"
            placeholder="填写患者补充文字" /></ElFormItem></ElForm
      ><template #footer
        ><ElButton :disabled="saving" @click="visible = false">取消</ElButton
        ><ElButton type="primary" :loading="saving" @click="save">保存代录反馈</ElButton></template
      ></ElDialog
    ></div
  >
</template>
<script setup lang="ts">
  import ResearchExport from '@/components/business/research-export/index.vue'
  import ResearchScopeFilter from '@/components/business/research-scope-filter/index.vue'

  import { computed, ref, onMounted, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import request from '@/utils/http'
  import { fetchPatientList, type PatientRecord } from '@/api/patient'
  interface Symptom {
    name: string
    change: string
  }
  interface Feedback {
    user_id?: number
    patient_name?: string
    date: string
    no_discomfort: boolean
    symptoms: Symptom[]
    note: string
    source?: string
  }
  const props = withDefaults(defineProps<{ embedded?: boolean; userId?: number }>(), {
      embedded: false,
      userId: 0
    }),
    route = useRoute(),
    embedded = computed(() => props.embedded),
    effectiveUserId = computed(() => props.userId || Number(route.query.user_id) || 0),
    names = ['咳嗽', '咳痰', '发热', '盗汗', '乏力', '食欲下降', '体重下降', '胸闷气短', '其他'],
    changes = ['首次记录', '减轻', '无变化', '加重', '新出现', '消失'],
    blank = (): Feedback => ({
      date: '',
      no_discomfort: false,
      symptoms: [],
      note: ''
    }),
    rows = ref<Feedback[]>([]),
    form = ref(blank()),
    patients = ref<PatientRecord[]>([]),
    keyword = ref(''),
    date = ref(''),
    projectId = ref<number | undefined>(Number(route.query.project_id) || undefined),
    groupId = ref<number | undefined>(Number(route.query.group_id) || undefined),
    dateRange = ref<string[]>([]),
    current = ref(1),
    total = ref(0),
    loading = ref(false),
    saving = ref(false),
    visible = ref(false)
  async function load() {
    loading.value = true
    try {
      const p = await request.get<{ list: Feedback[]; total: number }>({
        url: '/app/core/feedback/index',
        params: {
          keyword: keyword.value,
          date: date.value,
          user_id: effectiveUserId.value || undefined,
          project_id: projectId.value,
          group_id: groupId.value,
          start_date: dateRange.value[0],
          end_date: dateRange.value[1],
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
    form.value.user_id = effectiveUserId.value || undefined
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
  async function save() {
    saving.value = true
    try {
      await request.post({
        url: '/app/core/feedback/record',
        params: form.value,
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
    () => [route.fullPath, effectiveUserId.value],
    () => {
      current.value = 1
      void load()
    }
  )
  onMounted(load)
</script>
<style scoped>
  .page {
    padding: 20px;
  }

  .page.embedded {
    padding: 0;
  }

  .page.embedded > .toolbar {
    justify-content: flex-end;
    margin-top: 0;
  }

  .toolbar {
    display: flex;
    gap: 16px;
    align-items: center;
    margin: 16px 0;
  }

  .toolbar h2 {
    flex: 1;
  }

  .toolbar .el-input {
    max-width: 240px;
  }

  .toolbar .el-select {
    width: 180px;
  }

  .el-pagination {
    margin-top: 20px;
  }
</style>
