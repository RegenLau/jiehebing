<template>
  <section class="cockpit-page">
    <header class="cockpit-header">
      <h1><Icon icon="ri:dashboard-line" />随访工作台</h1>
      <div class="period-switch" aria-label="数据时间范围">
        <ElButtonGroup>
          <ElButton
            v-for="period in periods"
            :key="period.value"
            :type="activePeriod === period.value ? 'primary' : 'default'"
            @click="selectPeriod(period.value)"
          >
            {{ period.label }}
          </ElButton>
        </ElButtonGroup>
        <ElPopover
          v-model:visible="datePickerVisible"
          trigger="click"
          placement="bottom-end"
          width="220"
        >
          <template #reference>
            <ElButton class="calendar-button" circle aria-label="选择统计日期">
              <ElIcon><CalendarIcon /></ElIcon>
            </ElButton>
          </template>
          <ElDatePicker
            v-model="selectedDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择统计日期"
            style="width: 100%"
            @change="selectDate"
          />
        </ElPopover>
      </div>
    </header>

    <div class="dashboard-scope">
      <ResearchScopeFilter
        v-model:project-id="projectId"
        v-model:group-id="groupId"
        :show-date="false"
        @change="loadDashboard"
      />
      <span class="scope-note"
        >患者数为当前范围总人数；计划、完成和上报按所选日期范围统计。当前统计范围：{{
          projectId ? (groupId ? '所选分组' : '所选研究') : '全部研究'
        }}</span
      >
    </div>

    <div class="metric-grid">
      <article v-for="item in metrics" :key="item.title" class="metric-card">
        <div class="metric-icon" :class="item.tone">
          <ElIcon><component :is="item.icon" /></ElIcon>
        </div>
        <div>
          <p>{{ item.title }}</p>
          <strong>{{ item.value }}</strong>
          <span v-if="item.detail">{{ item.detail }}</span>
        </div>
      </article>
    </div>

    <div class="dashboard-grid">
      <article class="panel trend-panel">
        <div class="panel-title">
          <h2><Icon icon="ri:line-chart-line" />患者与服药执行趋势</h2>
        </div>
        <div ref="trendChartRef" class="chart trend-chart" aria-label="患者与服药执行趋势图" />
      </article>
      <div class="right-column">
        <article class="panel archive-panel">
          <div class="panel-title"
            ><h2><Icon icon="ri:login-circle-line" />登录状态</h2></div
          >
          <div class="archive-content">
            <div ref="archiveChartRef" class="chart archive-chart" aria-label="患者登录状态图" />
            <div class="legend-list">
              <p
                ><i class="blue" />可登录 <b>{{ archiveText.enabled }}</b></p
              >
              <p
                ><i class="gray" />未开通登录 <b>{{ archiveText.disabled }}</b></p
              >
            </div>
          </div>
        </article>
        <article class="panel adverse-panel">
          <div class="panel-title">
            <h2><Icon icon="ri:bar-chart-box-line" />不良反应严重程度</h2>
          </div>
          <div ref="adverseChartRef" class="chart adverse-chart" aria-label="不良反应严重程度图" />
        </article>
      </div>
      <div class="action-panel panel">
        <div class="panel-title">
          <h2><Icon icon="ri:task-line" />重点待办</h2>
          <span>点击进入对应处理列表</span>
        </div>
        <div class="todo-grid">
          <button
            v-for="item in todos"
            :key="item.label"
            class="todo-item"
            type="button"
            @click="navigateTo(item.path)"
          >
            <span class="todo-icon" :class="item.tone"
              ><ElIcon><component :is="item.icon" /></ElIcon
            ></span>
            <span class="todo-copy"
              ><b>{{ item.label }}</b
              ><small>{{ item.note }}</small></span
            >
            <strong :class="item.tone">{{ item.value }}</strong>
            <ElIcon class="todo-arrow"><ArrowRight /></ElIcon>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import ResearchScopeFilter from '@/components/business/research-scope-filter/index.vue'

  import { Icon } from '@iconify/vue'
  import type { EChartsOption } from '@/plugins/echarts'
  import {
    fetchDashboardOverview,
    type DashboardOverview,
    type DashboardRange
  } from '@/api/dashboard-overview'
  import { useChart } from '@/hooks/core/useChart'
  import { useCommon } from '@/hooks/core/useCommon'
  import {
    BellFilled,
    AlarmClock,
    ArrowRight,
    Calendar as CalendarIcon,
    CircleCheckFilled,
    Document,
    DocumentChecked,
    Memo,
    UserFilled
  } from '@element-plus/icons-vue'
  import { useRouter } from 'vue-router'

  defineOptions({ name: 'Console' })

  const periods: Array<{ label: string; value: DashboardRange }> = [
    { label: '今日', value: 'today' },
    { label: '近7天', value: '7d' },
    { label: '近30天', value: '30d' }
  ]
  const activePeriod = ref<DashboardRange>('today')
  const selectedDate = ref('')
  const projectId = ref<number>()
  const groupId = ref<number>()
  const datePickerVisible = ref(false)
  const router = useRouter()
  const dashboardData = ref<DashboardOverview>({
    range: 'today',
    date: '',
    metrics: {
      patient_total: 0,
      archived_total: 0,
      expected_total: 0,
      completed_total: 0,
      new_adverse_total: 0
    },
    login: { enabled: 0, disabled: 0 },
    resources: { survey_total: 0, article_total: 0, medicine_total: 0 },
    todos: { overdue_total: 0, pending_review_total: 0, pending_report_total: 0 },
    trend: {
      labels: ['07-10'],
      expected: [11],
      completed: [1]
    },
    adverse_severity: {
      mild: 1,
      moderate: 0,
      severe: 0
    }
  })
  const periodLabel = computed(
    () => periods.find((item) => item.value === activePeriod.value)?.label ?? ''
  )
  const metrics = computed(() => {
    const { metrics: data } = dashboardData.value
    const loginRate = data.patient_total
      ? Number(((dashboardData.value.login.enabled / data.patient_total) * 100).toFixed(1))
      : 0
    return [
      {
        title: '患者总数',
        value: data.patient_total,
        detail: '当前研究范围',
        icon: UserFilled,
        tone: 'blue'
      },
      {
        title: '登录开通率',
        value: `${loginRate}%`,
        detail: `${dashboardData.value.login.enabled} / ${data.patient_total} 人`,
        icon: DocumentChecked,
        tone: 'green'
      },
      {
        title: `${periodLabel.value}计划`,
        value: data.expected_total,
        detail: '应执行次数',
        icon: CalendarIcon,
        tone: 'blue'
      },
      {
        title: `${periodLabel.value}完成率`,
        value: `${data.expected_total ? ((data.completed_total / data.expected_total) * 100).toFixed(1) : '0.0'}%`,
        detail: `${data.completed_total} / ${data.expected_total} 次`,
        icon: CircleCheckFilled,
        tone: 'cyan'
      },
      {
        title: `${periodLabel.value}新增上报`,
        value: data.new_adverse_total,
        detail: '事件条数',
        icon: BellFilled,
        tone: 'orange'
      }
    ]
  })
  const todos = computed(() => [
    {
      label: '逾期服药任务',
      note: '需要优先处理',
      value: dashboardData.value.todos.overdue_total,
      icon: AlarmClock,
      tone: 'red',
      path: `/medication-plan/index?scope=all&status=0&overdue=1${activePeriod.value === 'today' ? '' : `&overdue_range=${activePeriod.value}`}${selectedDate.value ? `&as_of=${selectedDate.value}` : ''}${projectId.value ? `&project_id=${projectId.value}` : ''}${groupId.value ? `&group_id=${groupId.value}` : ''}`
    },
    {
      label: '待跟进事件',
      note: '核对不良反应记录',
      value: dashboardData.value.todos.pending_review_total,
      icon: Memo,
      tone: 'orange',
      path: `/adverse-reaction/index?pending=1&as_of=${dashboardData.value.date}${projectId.value ? `&project_id=${projectId.value}` : ''}${groupId.value ? `&group_id=${groupId.value}` : ''}`
    },
    {
      label: '待核对报告',
      note: '进入报告核对列表',
      value: dashboardData.value.todos.pending_report_total,
      icon: Document,
      tone: 'purple',
      path: `/reports/index?status=${encodeURIComponent('待核对')}${projectId.value ? `&project_id=${projectId.value}` : ''}${groupId.value ? `&group_id=${groupId.value}` : ''}`
    }
  ])
  const archiveText = computed(() => {
    const { enabled, disabled } = dashboardData.value.login
    const total = enabled + disabled
    return {
      enabled: `${enabled} (${total ? ((enabled / total) * 100).toFixed(1) : '0.0'}%)`,
      disabled: `${disabled} (${total ? ((disabled / total) * 100).toFixed(1) : '0.0'}%)`
    }
  })

  const {
    chartRef: trendChartRef,
    initChart: initTrendChart,
    handleResize: resizeTrendChart
  } = useChart()
  const {
    chartRef: archiveChartRef,
    initChart: initArchiveChart,
    handleResize: resizeArchiveChart
  } = useChart()
  const {
    chartRef: adverseChartRef,
    initChart: initAdverseChart,
    handleResize: resizeAdverseChart
  } = useChart()
  const { scrollToTop } = useCommon()

  const initCharts = () => {
    const baseText = { color: '#697386', fontSize: 12 }
    const trendOption: EChartsOption = {
      color: ['#4d84ee', '#42c98a', '#7856f7'],
      tooltip: { trigger: 'axis' },
      legend: {
        top: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: baseText,
        data: ['应执行（次）', '已完成（次）', '完成率（%）']
      },
      grid: { top: 52, left: 32, right: 42, bottom: 30, containLabel: true },
      xAxis: {
        type: 'category',
        data: dashboardData.value.trend.labels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#dce3ef' } },
        axisLabel: baseText
      },
      yAxis: [
        {
          type: 'value',
          max: Math.max(
            5,
            Math.ceil(
              Math.max(
                ...dashboardData.value.trend.expected,
                ...dashboardData.value.trend.completed
              ) / 5
            ) * 5
          ),
          splitNumber: 4,
          axisLabel: baseText,
          splitLine: { lineStyle: { color: '#edf0f5', type: 'dashed' } }
        },
        {
          type: 'value',
          max: 100,
          interval: 25,
          axisLabel: { ...baseText, formatter: '{value}%' },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: '应执行（次）',
          type: 'bar',
          barWidth: 14,
          data: dashboardData.value.trend.expected,
          itemStyle: { borderRadius: [2, 2, 0, 0] }
        },
        {
          name: '已完成（次）',
          type: 'bar',
          barWidth: 14,
          data: dashboardData.value.trend.completed,
          itemStyle: { borderRadius: [2, 2, 0, 0] }
        },
        {
          name: '完成率（%）',
          type: 'line',
          yAxisIndex: 1,
          data: dashboardData.value.trend.expected.map((value, index) =>
            value === 0
              ? 0
              : Number(((dashboardData.value.trend.completed[index] / value) * 100).toFixed(1))
          ),
          symbolSize: 7,
          lineStyle: { width: 2 },
          itemStyle: { color: '#7856f7' },
          label: { show: true, formatter: '{c}%', color: '#525b6b', fontSize: 11, position: 'top' }
        }
      ]
    }
    initTrendChart(trendOption)
    initArchiveChart({
      series: [
        {
          type: 'pie',
          radius: ['58%', '76%'],
          center: ['50%', '52%'],
          label: {
            show: true,
            position: 'center',
            formatter: `{count|${dashboardData.value.login.enabled + dashboardData.value.login.disabled}}\n{name|总数}`,
            rich: {
              count: { fontSize: 27, fontWeight: 700, color: '#1d2638', lineHeight: 34 },
              name: { fontSize: 12, color: '#697386' }
            }
          },
          data: [
            {
              value: dashboardData.value.login.enabled,
              name: '可登录',
              itemStyle: { color: '#4d84ee' }
            },
            {
              value: dashboardData.value.login.disabled,
              name: '未开通登录',
              itemStyle: { color: '#dce2ee' }
            }
          ]
        }
      ]
    })
    initAdverseChart({
      grid: { left: 55, right: 18, top: 10, bottom: 10 },
      xAxis: {
        type: 'value',
        max: Math.max(
          3,
          dashboardData.value.adverse_severity.mild,
          dashboardData.value.adverse_severity.moderate,
          dashboardData.value.adverse_severity.severe
        ),
        minInterval: 1,
        axisLabel: baseText,
        splitLine: { lineStyle: { color: '#edf0f5' } }
      },
      yAxis: {
        type: 'category',
        data: ['重度', '中度', '轻度'],
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: baseText
      },
      series: [
        {
          type: 'bar',
          data: [
            dashboardData.value.adverse_severity.severe,
            dashboardData.value.adverse_severity.moderate,
            dashboardData.value.adverse_severity.mild
          ],
          barWidth: 12,
          label: { show: true, position: 'right', color: '#697386' },
          itemStyle: { color: '#4d84ee', borderRadius: [0, 3, 3, 0] }
        }
      ]
    })
  }

  const resizeCharts = () => {
    resizeTrendChart()
    resizeArchiveChart()
    resizeAdverseChart()
  }

  const navigateTo = (path: string) => router.push(path)

  const refreshCharts = () => {
    nextTick(() => {
      setTimeout(() => {
        loadDashboard()
      }, 500)
    })
  }

  const loadDashboard = async () => {
    try {
      dashboardData.value = await fetchDashboardOverview(
        activePeriod.value,
        selectedDate.value || undefined,
        { project_id: projectId.value, group_id: groupId.value }
      )
    } catch (error) {
      console.error('加载工作台统计失败:', error)
    } finally {
      initCharts()
      resizeCharts()
    }
  }

  const selectPeriod = (range: DashboardRange) => {
    if (activePeriod.value === range) return
    activePeriod.value = range
    loadDashboard()
  }

  const selectDate = (date: string | null) => {
    if (!date) return
    activePeriod.value = 'today'
    datePickerVisible.value = false
    loadDashboard()
  }

  onMounted(() => {
    scrollToTop()
    refreshCharts()
  })

  onActivated(() => {
    refreshCharts()
  })
</script>

<style scoped lang="scss">
  .cockpit-page {
    color: #1d2638;
    padding-bottom: 40px;
  }
  .cockpit-header,
  .panel-title,
  .period-switch,
  .archive-content,
  .todo-item {
    display: flex;
    align-items: center;
  }
  .cockpit-header {
    justify-content: space-between;
    margin: 2px 0 22px;
  }
  .dashboard-scope {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
    margin-bottom: 18px;
    color: var(--el-text-color-secondary);
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  h1 {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .period-switch {
    gap: 10px;
  }
  .period-switch :deep(.el-button) {
    height: 36px;
    min-width: 68px;
    border-radius: 7px;
  }
  .period-switch :deep(.el-button + .el-button) {
    margin-left: -1px;
    border-radius: 0;
  }
  .period-switch :deep(.el-button:first-child) {
    border-radius: 7px 0 0 7px;
  }
  .period-switch :deep(.el-button:nth-child(3)) {
    border-radius: 0 7px 7px 0;
  }
  .period-switch > :deep(.el-button) {
    min-width: 36px;
    padding: 8px;
  }
  .calendar-button :deep(.el-icon) {
    color: #52627c;
    font-size: 18px;
  }
  .metric-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 20px;
    margin-bottom: 20px;
  }
  .metric-card,
  .resource-card,
  .panel {
    background: #fff;
    border: 1px solid #e7ebf2;
    border-radius: 10px;
    box-shadow: 0 2px 7px rgb(34 57 94 / 3%);
  }
  .metric-card {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 126px;
    padding: 16px;
  }
  .metric-card > :last-child {
    min-width: 0;
  }
  .metric-icon,
  .resource-icon {
    display: grid;
    flex: none;
    place-items: center;
    border-radius: 50%;
    font-size: 28px;
  }
  .metric-icon {
    width: 56px;
    height: 56px;
  }
  .metric-icon :deep(.el-icon) {
    font-size: 30px;
  }
  .metric-card p,
  .resource-card p {
    color: #384355;
    font-size: 15px;
    white-space: nowrap;
  }
  .metric-card p {
    font-size: 14px;
    letter-spacing: -0.02em;
  }
  .metric-card strong {
    display: block;
    margin-top: 6px;
    color: #151d2e;
    font-size: 36px;
    line-height: 1;
  }
  .metric-card span {
    display: block;
    margin-top: 10px;
    color: #758198;
    font-size: 14px;
  }
  .blue {
    color: #4d84ee;
    background: #eaf1ff;
  }
  .green {
    color: #35bf7e;
    background: #e6f8ef;
  }
  .cyan {
    color: #26b7cc;
    background: #e3f8fa;
  }
  .orange {
    color: #ff8c16;
    background: #fff0df;
  }
  .purple {
    color: #875bf0;
    background: #f0eaff;
  }
  .red {
    color: #f04455;
    background: #fff0f1;
  }
  .dashboard-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(340px, 1fr);
    gap: 20px;
  }
  .panel {
    padding: 20px;
  }
  .panel-title {
    justify-content: space-between;
    margin-bottom: 8px;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 17px;
    font-weight: 650;
  }
  h1 :deep(svg) {
    color: #4d84ee;
    font-size: 28px;
  }
  h2 :deep(svg) {
    color: #5f6f8a;
    font-size: 18px;
  }
  .panel-title span {
    color: #68758d;
    font-size: 13px;
  }
  .trend-panel {
    min-height: 360px;
  }
  .chart {
    width: 100%;
  }
  .trend-chart {
    height: 300px;
  }
  .right-column {
    display: grid;
    gap: 12px;
    grid-template-rows: 1fr 1fr;
  }
  .archive-panel,
  .adverse-panel {
    min-height: 174px;
  }
  .archive-content {
    justify-content: center;
    gap: 10px;
    height: 128px;
  }
  .archive-chart {
    width: 150px;
    height: 128px;
  }
  .legend-list {
    display: grid;
    gap: 15px;
    min-width: 160px;
    color: #475266;
    font-size: 13px;
  }
  .legend-list p {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .legend-list i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .legend-list b {
    margin-left: auto;
    font-weight: 500;
  }
  .legend-list .blue {
    background: #4d84ee;
  }
  .legend-list .gray {
    background: #dce2ee;
  }
  .adverse-chart {
    height: 113px;
  }
  .action-panel {
    grid-column: 1 / -1;
    padding: 18px;
  }
  .todo-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .todo-item {
    width: 100%;
    gap: 10px;
    min-height: 64px;
    padding: 10px 12px;
    color: #445067;
    background: #fbfcfe;
    border: 1px solid #e7ebf2;
    border-radius: 7px;
    text-align: left;
  }
  .todo-icon {
    display: grid;
    width: 34px;
    height: 34px;
    flex: none;
    place-items: center;
    border-radius: 9px;
    font-size: 18px;
  }
  .todo-copy {
    display: grid;
    gap: 4px;
    min-width: 0;
  }
  .todo-copy b {
    color: #2b3447;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.35;
  }
  .todo-copy small {
    color: #8994a8;
    font-size: 12px;
    line-height: 1.35;
  }
  .todo-item > strong {
    margin-left: auto;
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
  }
  .todo-arrow {
    color: #9aa5b8;
    font-size: 17px;
  }
  @media (max-width: 1300px) {
    .metric-grid {
      grid-template-columns: repeat(3, 1fr);
    }
    .dashboard-grid {
      grid-template-columns: 1fr;
    }
    .right-column {
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: auto;
    }
  }
  @media (max-width: 760px) {
    .cockpit-header {
      align-items: flex-start;
      gap: 14px;
      flex-direction: column;
    }
    .metric-grid,
    .resource-grid,
    .right-column {
      grid-template-columns: 1fr;
    }
    .metric-card {
      min-height: 100px;
    }
    .period-switch {
      width: 100%;
    }
    .period-switch :deep(.el-button) {
      min-width: 0;
      flex: 1;
    }
  }
</style>
