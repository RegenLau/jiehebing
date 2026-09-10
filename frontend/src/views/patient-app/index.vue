<template>
  <main class="patient-app" :class="{ 'is-login': stage === 'login' }">
    <section v-if="stage === 'loading'" class="center-state" aria-live="polite">
      <ArtSvgIcon class="loading-icon" icon="ri:loader-4-line" />
      <p>正在读取您的健康计划</p>
    </section>

    <section v-else-if="stage === 'login'" class="login-page">
      <div class="login-brand">
        <span class="brand-icon"><ArtSvgIcon icon="ri:user-heart-line" /></span>
        <p>结核病临床研究患者端</p>
        <h1>登录后查看您的康复计划</h1>
        <span>仅限医生已在后台建档的患者使用</span>
      </div>
      <form class="login-card" @submit.prevent="login">
        <label for="patient-mobile">手机号</label>
        <div class="mobile-field">
          <span>+86</span>
          <input
            id="patient-mobile"
            v-model.trim="mobile"
            type="tel"
            inputmode="numeric"
            autocomplete="tel"
            maxlength="11"
            placeholder="请输入后台登记的手机号"
          />
        </div>
        <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
        <button class="primary-button" type="submit" :disabled="submitting">
          {{ submitting ? '正在登录…' : '登录' }}
        </button>
        <button class="demo-button" type="button" @click="mobile = '13910001019'">
          填入演示手机号 13910001019
        </button>
        <button class="demo-button" type="button" @click="mobile = '13910001029'">
          填入待开始患者 13910001029
        </button>
      </form>
    </section>

    <template v-else-if="data">
      <header v-if="stage !== 'home' && stage !== 'pending_start'" class="page-header">
        <button class="icon-button" type="button" aria-label="退出登录" @click="logout">
          <ArtSvgIcon icon="ri:arrow-left-s-line" />
        </button>
        <h1>{{ isIdentityStage ? '信息确认' : isMedicationStage ? '药品确认' : '确认完成' }}</h1>
        <span class="header-spacer"></span>
      </header>

      <section v-if="isIdentityStage" class="flow-page">
        <div class="step-copy">
          <p>第 <strong>1</strong> 步 / 共 2 步</p>
          <div class="progress-track"><span style="width: 50%"></span></div>
          <p>请核对以下信息，确认无误后进入药品确认。</p>
        </div>

        <article v-if="stage === 'identity_issue'" class="issue-state" aria-live="polite">
          <span class="issue-icon"><ArtSvgIcon icon="ri:alarm-warning-line" /></span>
          <h2>问题已提交</h2>
          <p>工作人员会根据您的说明核对并修改资料。资料更新后，您重新进入即可再次确认。</p>
          <div class="issue-note">您提交的说明：{{ data.identity_confirmation?.note }}</div>
        </article>

        <template v-else>
          <article class="info-card">
            <h2>基础信息</h2>
            <dl class="identity-list">
              <div
                ><dt>姓名</dt><dd>{{ data.patient.name }}</dd></div
              >
              <div
                ><dt>手机号</dt><dd>{{ data.patient.mobile }}</dd></div
              >
              <div
                ><dt>性别</dt><dd>{{ data.patient.gender_text }}</dd></div
              >
              <div
                ><dt>出生年月</dt><dd>{{ data.patient.birth_date }}</dd></div
              >
            </dl>
          </article>
          <article class="study-card">
            <span>所属研究</span>
            <strong>{{ data.patient.project_name }}</strong>
            <small>{{ data.patient.group_name }} · 入组日期 {{ data.patient.enroll_date }}</small>
          </article>
        </template>
      </section>

      <section v-else-if="isMedicationStage" class="flow-page medication-page">
        <div class="step-copy">
          <p>第 <strong>2</strong> 步 / 共 2 步</p>
          <div class="progress-track"><span style="width: 100%"></span></div>
          <p>请逐项核对药品数量、规格及用法用量。</p>
        </div>

        <article v-if="stage === 'medication_issue'" class="issue-state" aria-live="polite">
          <span class="issue-icon"><ArtSvgIcon icon="ri:alarm-warning-line" /></span>
          <h2>用药疑问已提交</h2>
          <p>请先按医生已确认的线下安排执行。工作人员核对并更新后，您需要重新确认。</p>
          <div class="issue-note">您提交的说明：{{ data.medication_confirmation?.note }}</div>
        </article>

        <template v-else-if="data.treatment">
          <article v-for="drug in data.treatment.drugs" :key="drug.drug_id" class="medicine-card">
            <div class="medicine-main">
              <span class="medicine-icon"><ArtSvgIcon icon="ri:medicine-bottle-line" /></span>
              <div>
                <h2>{{ drug.name }}</h2>
                <p
                  ><strong>共 {{ drug.quantity }} {{ drug.unit }}</strong
                  ><span>{{ drug.specification }}</span></p
                >
                <p>{{ drug.frequency }}，每次 {{ drug.dose }} {{ drug.unit }}</p>
                <small>服药时间 {{ drug.times.join('、') }}</small>
              </div>
            </div>
            <button
              class="drug-confirm-button"
              :class="{ confirmed: confirmedDrugs.includes(drug.drug_id) }"
              type="button"
              @click="toggleDrug(drug.drug_id)"
            >
              <ArtSvgIcon v-if="confirmedDrugs.includes(drug.drug_id)" icon="ri:check-line" />
              {{ confirmedDrugs.includes(drug.drug_id) ? '已确认' : '确认药品' }}
            </button>
          </article>
        </template>
        <article v-else class="issue-state">
          <span class="issue-icon"><ArtSvgIcon icon="ri:medicine-bottle-line" /></span>
          <h2>用药安排待配置</h2>
          <p>医生完成用药安排后，您即可在这里核对。</p>
        </article>
      </section>

      <section v-else-if="stage === 'pending_start'" class="pending-start-page">
        <header class="pending-start-header">
          <h1>确认完成</h1>
        </header>

        <div class="pending-start-status" aria-live="polite">
          <img :src="pendingStartImage" alt="用药计划已确认，等待开始" />
          <h2>信息与药品已确认</h2>
          <p>您的用药计划尚未开始</p>
        </div>

        <article class="pending-start-time-card">
          <span class="pending-start-label">开始服药时间</span>
          <div class="pending-start-date-row">
            <strong>{{ medicationStartDateText }}</strong>
            <span>尚未开始</span>
          </div>
          <time :datetime="data.medication_start?.start_at">{{ medicationStartTimeText }}</time>
        </article>

        <article class="pending-start-guidance">
          <span class="pending-start-info" aria-hidden="true">
            <ArtSvgIcon icon="ri:information-line" />
          </span>
          <div>
            <h2>请按计划开始服药</h2>
            <p
              >到达开始时间后，重新进入小程序即可查看首页和服药安排。期间如有疑问，请联系随访医生。</p
            >
          </div>
        </article>

        <p class="pending-start-note">开始时间以医生确认的用药方案为准</p>
      </section>

      <section v-else class="main-shell">
        <div v-if="homeLoading" class="center-state shell-loading" aria-live="polite">
          <ArtSvgIcon class="loading-icon" icon="ri:loader-4-line" />
          <p>正在更新康复计划</p>
        </div>

        <template v-else-if="homeData">
          <section v-if="adverseOpen" class="tab-page adverse-view">
            <header class="task-detail-heading">
              <button type="button" aria-label="返回首页" @click="closeAdverseReport">
                <ArtSvgIcon icon="ri:arrow-left-s-line" />
              </button>
              <div>
                <h1>不良反应上报</h1>
              </div>
            </header>

            <article v-if="adverseSubmitted" class="adverse-success" aria-live="polite">
              <span class="success-icon"><ArtSvgIcon icon="ri:check-line" /></span>
              <h2>上报成功</h2>
              <p>随访团队已收到本次记录，将根据情况与您联系。</p>
              <button class="wide-primary" type="button" @click="closeAdverseReport">
                返回首页
              </button>
            </article>

            <form v-else class="task-form adverse-form" @submit.prevent="submitAdverseReport">
              <label for="adverse-time">发生时间</label>
              <input
                id="adverse-time"
                v-model="adverseForm.occurred_at"
                type="datetime-local"
                :max="adverseMaxTime"
              />
              <fieldset>
                <legend>主要症状（多选）</legend>
                <div class="choice-grid symptom-grid adverse-symptoms">
                  <button
                    v-for="symptom in adverseSymptomOptions"
                    :key="symptom"
                    :class="{ selected: adverseForm.symptoms.includes(symptom) }"
                    type="button"
                    @click="toggleAdverseSymptom(symptom)"
                  >
                    {{ symptom }}
                  </button>
                </div>
              </fieldset>
              <label for="adverse-description">症状描述</label>
              <textarea
                id="adverse-description"
                v-model.trim="adverseForm.description"
                rows="5"
                maxlength="2000"
                placeholder="请详细描述您的不适感受，例如：吃药后半小时开始恶心，持续了多久…"
              ></textarea>
              <fieldset>
                <legend>严重程度</legend>
                <div class="severity-options">
                  <button
                    v-for="option in adverseSeverityOptions"
                    :key="option.value"
                    :class="[
                      `severity-${option.value}`,
                      { selected: adverseForm.severity === option.value }
                    ]"
                    type="button"
                    @click="adverseForm.severity = option.value"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </fieldset>
              <div
                v-if="adverseForm.severity"
                class="severity-guidance"
                :class="`severity-${adverseForm.severity}`"
                role="status"
              >
                <ArtSvgIcon icon="ri:alarm-warning-line" />
                <div>
                  <strong>{{ adverseGuidance.title }}</strong>
                  <p>{{ adverseGuidance.text }}</p>
                </div>
              </div>
              <p v-if="adverseError" class="form-error" role="alert">{{ adverseError }}</p>
              <button
                class="wide-primary adverse-submit"
                :class="{ urgent: adverseForm.severity === 3 }"
                type="submit"
                :disabled="adverseSubmitting"
              >
                {{
                  adverseSubmitting
                    ? '正在上报…'
                    : adverseForm.severity === 3
                      ? '立即上报并寻求就医指导'
                      : '提交上报'
                }}
              </button>
            </form>
          </section>

          <section v-else-if="activeTab === 'home'" class="tab-page home-view">
            <header class="home-heading">
              <div>
                <h1>我的康复计划</h1>
                <p
                  >治疗第{{ homeData.progress.current_day }}天 · 计划共{{
                    homeData.progress.total_days
                  }}天</p
                >
              </div>
              <span class="doctor-mark" aria-hidden="true"
                ><ArtSvgIcon icon="ri:nurse-line"
              /></span>
            </header>

            <article class="next-card">
              <template v-if="homeData.next_medication">
                <div class="card-label">{{
                  medicationDateLabel(homeData.next_medication.date)
                }}</div>
                <div class="next-time-row">
                  <strong>{{ homeData.next_medication.time }}</strong>
                  <span>待服药</span>
                </div>
                <button class="medication-preview" type="button" @click="activeTab = 'medication'">
                  <span class="round-icon blue"><ArtSvgIcon icon="ri:medicine-bottle-line" /></span>
                  <span class="preview-copy">
                    <strong>本次共 {{ homeData.next_medication.drugs.length }} 种药</strong>
                    <small>{{
                      homeData.next_medication.drugs.map((drug) => drug.name).join('、')
                    }}</small>
                  </span>
                  <ArtSvgIcon class="chevron" icon="ri:arrow-right-s-line" />
                </button>
                <button class="wide-primary" type="button" @click="activeTab = 'medication'"
                  >查看用药安排</button
                >
              </template>
              <div
                v-else-if="homeData.patient.study_state === '暂停用药'"
                class="empty-inline paused"
              >
                <span class="round-icon orange"><ArtSvgIcon icon="ri:pause-circle-line" /></span>
                <div
                  ><strong>当前用药已暂停</strong
                  ><small>请按医生最新安排执行，恢复后会重新显示服药时点</small></div
                >
              </div>
              <div v-else class="empty-inline">
                <span class="round-icon green"><ArtSvgIcon icon="ri:check-line" /></span>
                <div
                  ><strong>当前没有待服药安排</strong><small>可在“用药”中查看今日记录</small></div
                >
              </div>
            </article>

            <button class="health-card" type="button" @click="openAdverseReport">
              <span class="round-icon orange"><ArtSvgIcon icon="ri:alarm-warning-line" /></span>
              <span>
                <strong>身体不适上报</strong>
                <small>出现身体不适，可随时上报</small>
              </span>
              <em>去上报</em>
            </button>

            <div class="section-title">
              <h2>待办任务</h2>
              <span>{{ homeData.pending_task_count }} 项待完成</span>
            </div>
            <div v-if="homeData.pending_tasks.length" class="task-stack compact">
              <button
                v-for="task in homeData.pending_tasks.slice(0, 2)"
                :key="task.id"
                class="task-card"
                type="button"
                @click="activeTab = 'tasks'"
              >
                <span class="round-icon blue"><ArtSvgIcon :icon="taskIcon(task.type)" /></span>
                <span class="task-copy">
                  <strong>{{ task.name }}</strong>
                  <small>{{ taskTimeText(task) }}</small>
                </span>
                <em>查看待办</em>
              </button>
            </div>
            <article v-else class="empty-card">当前没有待办任务</article>
          </section>

          <section v-else-if="activeTab === 'medication'" class="tab-page medication-view">
            <header class="section-heading">
              <h1>用药方案</h1>
              <p>查看并记录今日服药情况</p>
            </header>
            <div class="segment-control" aria-label="用药页面切换">
              <button
                :class="{ active: medicationPanel === 'checkin' }"
                type="button"
                @click="medicationPanel = 'checkin'"
                >服药打卡</button
              >
              <button
                :class="{ active: medicationPanel === 'medicines' }"
                type="button"
                @click="medicationPanel = 'medicines'"
                >我的药品</button
              >
            </div>

            <template v-if="medicationData && medicationPanel === 'checkin'">
              <article class="summary-card medication-summary-card">
                <span class="medication-clock" aria-hidden="true">
                  <ArtSvgIcon icon="ri:time-line" />
                </span>
                <div class="next-medication-summary">
                  <small>下次服药时间</small>
                  <strong>{{ medicationData.next_slot?.time || '--:--' }}</strong>
                </div>
                <span class="medication-progress-ring" aria-hidden="true">
                  <ElProgress
                    type="circle"
                    :percentage="medicationCompletionPercentage"
                    :width="40"
                    :stroke-width="8"
                    :show-text="false"
                    color="#2167ff"
                  />
                </span>
                <div class="today-medication-summary">
                  <span
                    >今日共 <strong>{{ homeData.medication_today.total_slots }}</strong> 次</span
                  >
                  <span
                    >已完成
                    <strong>{{ homeData.medication_today.completed_slots }}</strong> 次</span
                  >
                </div>
              </article>
              <div v-if="pendingMedicationSlots.length" class="medication-schedule">
                <section
                  v-for="slot in pendingMedicationSlots"
                  :key="slot.id"
                  class="medication-slot"
                >
                  <header class="medication-slot-heading">
                    <h2>
                      <span>{{ medicationPeriodLabel(slot.time) }}</span>
                      {{ slot.time }}
                    </h2>
                    <span class="timing-pill">{{ medicationTimingLabel(slot) }}</span>
                    <span class="status-pill pending">待服药</span>
                  </header>
                  <div class="medication-drug-list">
                    <article
                      v-for="drug in pendingDrugs(slot)"
                      :key="drug.plan_id"
                      class="medication-drug-card"
                    >
                      <span class="timeline-dot" aria-hidden="true">
                        <ArtSvgIcon icon="ri:checkbox-blank-circle-line" />
                      </span>
                      <img :src="medicinePackageImage" alt="药品包装示意图" />
                      <div class="medication-drug-copy">
                        <h3>{{ drug.name }}</h3>
                        <p>每次 {{ drug.dose }} {{ drug.unit }} · {{ drug.specification }}</p>
                      </div>
                      <button
                        class="drug-checkin-button"
                        type="button"
                        :disabled="medicationSubmittingPlanId !== null || !slot.recordable"
                        @click="recordMedicationDrug(drug.plan_id)"
                      >
                        {{
                          !slot.recordable
                            ? '未到时间'
                            : medicationSubmittingPlanId === drug.plan_id
                              ? '打卡中…'
                              : '打卡'
                        }}
                      </button>
                    </article>
                  </div>
                </section>
              </div>
              <article v-else class="empty-card medication-empty">{{
                homeData.patient.study_state === '暂停用药'
                  ? '当前用药已暂停'
                  : '今天没有待服药安排'
              }}</article>
            </template>

            <div v-else-if="medicationData" class="medicine-list">
              <article v-for="drug in medicationData.medicines" :key="drug.drug_id">
                <span class="medicine-tile"><ArtSvgIcon icon="ri:medicine-bottle-line" /></span>
                <div>
                  <h2>{{ drug.name }}</h2>
                  <p>{{ drug.specification }} · 每次 {{ drug.dose }} {{ drug.unit }}</p>
                  <small>{{ drug.frequency }} · {{ drug.times.join('、') }}</small>
                </div>
                <template v-if="drugStock(drug.drug_id)">
                  <strong :class="{ warning: drugStock(drug.drug_id)?.needs_pickup }">
                    预计余药 {{ drugStock(drug.drug_id)?.estimated }} {{ drug.unit }} · 约
                    {{ drugStock(drug.drug_id)?.days }} 天
                  </strong>
                  <small v-if="drugStock(drug.drug_id)?.needs_pickup" class="stock-warning">
                    余药预计不足，请按取药任务安排或联系随访人员
                  </small>
                </template>
                <strong v-else>计划数量 {{ drug.quantity }} {{ drug.unit }}</strong>
                <details v-if="drug.precautions" class="medicine-guidance">
                  <summary>查看用药指导</summary>
                  <p>{{ drug.precautions }}</p>
                </details>
              </article>
              <p v-if="medicationData.stock.length" class="stock-method">
                余药为系统估算值。{{ medicationData.stock[0].method }}
              </p>
              <article v-if="!medicationData.medicines.length" class="empty-card"
                >医生尚未配置用药方案</article
              >
            </div>
            <article v-else class="empty-card">正在读取用药安排</article>
            <p v-if="medicationError" class="form-error" role="alert">{{ medicationError }}</p>
          </section>

          <section v-else-if="activeTab === 'tasks'" class="tab-page">
            <template v-if="selectedTask">
              <header class="task-detail-heading">
                <button type="button" aria-label="返回任务列表" @click="closeTask">
                  <ArtSvgIcon icon="ri:arrow-left-s-line" />
                </button>
                <div
                  ><h1>{{ selectedTask.type === '问卷' ? '随访问卷' : selectedTask.name }}</h1
                  ><p>{{
                    selectedTask.type === '问卷'
                      ? selectedTask.name + ' · ' + taskTimeText(selectedTask)
                      : taskTimeText(selectedTask)
                  }}</p></div
                >
              </header>

              <form
                v-if="selectedTask.type === '健康反馈'"
                class="task-form"
                @submit.prevent="submitFeedback"
              >
                <fieldset>
                  <legend>今天感觉怎么样？</legend>
                  <div class="choice-grid two-columns">
                    <button
                      :class="{ selected: feedbackNoDiscomfort === true }"
                      type="button"
                      @click="setDiscomfort(false)"
                      >今天没有不适</button
                    >
                    <button
                      :class="{ selected: feedbackNoDiscomfort === false }"
                      type="button"
                      @click="setDiscomfort(true)"
                      >有不适需要记录</button
                    >
                  </div>
                </fieldset>
                <fieldset v-if="feedbackNoDiscomfort === false">
                  <legend>请选择症状</legend>
                  <div class="choice-grid symptom-grid">
                    <button
                      v-for="symptom in symptomOptions"
                      :key="symptom"
                      :class="{ selected: selectedSymptoms.includes(symptom) }"
                      type="button"
                      @click="toggleSymptom(symptom)"
                      >{{ symptom }}</button
                    >
                  </div>
                  <label for="symptom-change">与上一次相比</label>
                  <select id="symptom-change" v-model="symptomChange">
                    <option v-for="change in symptomChanges" :key="change" :value="change">{{
                      change
                    }}</option>
                  </select>
                </fieldset>
                <label for="feedback-note">补充说明（选填）</label>
                <textarea
                  id="feedback-note"
                  v-model.trim="feedbackNote"
                  rows="4"
                  maxlength="2000"
                  placeholder="可填写症状细节；语音转成文字后也会显示在这里"
                ></textarea>
                <div class="speech-input-row">
                  <button
                    type="button"
                    :class="{ listening: speechListening }"
                    :disabled="!speechSupported"
                    @click="toggleSpeechInput"
                  >
                    <ArtSvgIcon :icon="speechListening ? 'ri:stop-circle-line' : 'ri:mic-line'" />
                    {{ speechListening ? '停止识别' : '语音转文字' }}
                  </button>
                  <small>{{
                    speechSupported
                      ? speechMessage || '语音只转成文字，提交前请核对；系统不会保存录音。'
                      : '当前浏览器不支持语音识别，请直接输入文字。'
                  }}</small>
                </div>
                <p v-if="taskError" class="form-error" role="alert">{{ taskError }}</p>
                <button class="wide-primary" type="submit" :disabled="taskSubmitting">{{
                  taskSubmitting ? '提交中…' : '提交今日反馈'
                }}</button>
              </form>

              <form
                v-else-if="selectedTask.type === '问卷' && selectedTask.form"
                class="task-form survey-form"
                @submit.prevent="submitSurvey"
              >
                <p class="form-intro">{{ selectedTask.form.description }}</p>
                <fieldset v-for="question in selectedTask.form.questions" :key="question.id">
                  <legend>第{{ question.questionNo }}题 {{ question.title }}</legend>
                  <textarea
                    v-if="question.type === 'TEXT'"
                    v-model.trim="surveyAnswers[question.id].text_value"
                    rows="3"
                    :placeholder="question.placeholder || '请输入回答'"
                  ></textarea>
                  <template v-else>
                    <div
                      class="survey-option-grid"
                      :class="{ 'three-columns': question.options.length === 3 }"
                    >
                      <label
                        v-for="option in question.options"
                        :key="option.id"
                        class="option-row"
                        :class="{
                          selected: surveyAnswers[question.id].option_ids.includes(option.id)
                        }"
                      >
                        <input
                          class="visually-hidden"
                          :checked="surveyAnswers[question.id].option_ids.includes(option.id)"
                          :type="question.type === 'RADIO' ? 'radio' : 'checkbox'"
                          :name="'question-' + question.id"
                          @change="toggleSurveyOption(question, option.id)"
                        />
                        <span>{{ option.label }}</span>
                      </label>
                    </div>
                    <template v-for="option in question.options" :key="`extra-${option.id}`">
                      <input
                        v-if="
                          option.triggerInput &&
                          surveyAnswers[question.id].option_ids.includes(option.id)
                        "
                        v-model.trim="
                          surveyAnswers[question.id].extra_inputs[
                            option.inputFields?.[0]?.field_key || 'detail'
                          ]
                        "
                        class="extra-input"
                        :placeholder="option.inputFields?.[0]?.placeholder || '请补充说明'"
                      />
                    </template>
                  </template>
                </fieldset>
                <p v-if="taskError" class="form-error" role="alert">{{ taskError }}</p>
                <button class="wide-primary" type="submit" :disabled="taskSubmitting">{{
                  taskSubmitting ? '提交中…' : '提交问卷'
                }}</button>
              </form>
            </template>

            <template v-else>
              <header class="section-heading">
                <h1>任务提醒</h1>
                <p>待完成 {{ taskData?.tasks.length || 0 }} 项</p>
              </header>
              <div v-if="taskData?.tasks.length" class="task-stack">
                <button
                  v-for="task in taskData.tasks"
                  :key="task.id"
                  class="task-card"
                  type="button"
                  @click="openTask(task)"
                >
                  <span class="round-icon blue"><ArtSvgIcon :icon="taskIcon(task.type)" /></span>
                  <span class="task-copy">
                    <strong>{{ task.name }}</strong>
                    <small>{{ task.description || taskTimeText(task) }}</small>
                    <small class="deadline">{{ taskTimeText(task) }}</small>
                  </span>
                  <span class="status-link">{{ taskAction(task.type) }}</span>
                </button>
              </div>
              <article v-else class="empty-card">当前没有待办任务</article>
            </template>
          </section>

          <section v-else class="tab-page profile-view">
            <template v-if="profileMode === 'main'">
              <header class="profile-heading">
                <span class="avatar">{{ homeData.patient.name.slice(-1) }}</span>
                <div
                  ><h1>{{ homeData.patient.name }}</h1
                  ><p
                    >治疗第{{ homeData.progress.current_day }}天 · 计划共{{
                      homeData.progress.total_days
                    }}天</p
                  ></div
                >
              </header>
              <div class="profile-menu">
                <button type="button" @click="openReports">
                  <span class="round-icon blue"><ArtSvgIcon icon="ri:file-list-3-line" /></span>
                  <span><strong>我的报告</strong><small>查看和上传检查报告</small></span>
                  <ArtSvgIcon class="chevron" icon="ri:arrow-right-s-line" />
                </button>
                <button type="button" @click="openSupport('reminders')">
                  <span class="round-icon purple">
                    <ArtSvgIcon icon="ri:notification-3-line" />
                  </span>
                  <span><strong>提醒设置</strong><small>查看研究组提醒安排</small></span>
                  <ArtSvgIcon class="chevron" icon="ri:arrow-right-s-line" />
                </button>
                <button type="button" @click="openSupport('contact')">
                  <span class="round-icon green"><ArtSvgIcon icon="ri:phone-line" /></span>
                  <span><strong>联系药师 / 医院</strong><small>查看研究联系人</small></span>
                  <ArtSvgIcon class="chevron" icon="ri:arrow-right-s-line" />
                </button>
                <button type="button" @click="openSupport('education')">
                  <span class="round-icon orange"><ArtSvgIcon icon="ri:book-open-line" /></span>
                  <span><strong>健康科普</strong><small>查看研究团队发布的健康内容</small></span>
                  <ArtSvgIcon class="chevron" icon="ri:arrow-right-s-line" />
                </button>
              </div>
              <button class="logout-button" type="button" @click="logout">退出登录</button>
            </template>

            <template v-else-if="profileMode === 'reports'">
              <header class="task-detail-heading">
                <button type="button" aria-label="返回我的" @click="profileMode = 'main'">
                  <ArtSvgIcon icon="ri:arrow-left-s-line" />
                </button>
                <div>
                  <h1>我的报告</h1>
                  <p>共 {{ filteredReports.length }} 份报告</p>
                </div>
              </header>
              <div class="report-filters" aria-label="报告筛选">
                <button
                  v-for="filter in reportFilters"
                  :key="filter.value"
                  :class="{ active: reportFilter === filter.value }"
                  type="button"
                  @click="reportFilter = filter.value"
                  >{{ filter.label }}</button
                >
              </div>
              <div v-if="filteredReports.length" class="report-list">
                <button
                  v-for="report in filteredReports"
                  :key="report.id"
                  type="button"
                  @click="openReportDetail(report.id)"
                >
                  <span class="round-icon blue"><ArtSvgIcon icon="ri:file-chart-line" /></span>
                  <span
                    ><strong>{{ report.type }}</strong
                    ><small>检查日期：{{ report.exam_date }}</small></span
                  >
                  <em :class="reportStatusClass(report.status)">{{
                    reportStatusText(report.status)
                  }}</em>
                  <span v-if="report.status === '需补充'" class="supplement-tip"
                    >报告不完整，请补充上传</span
                  >
                </button>
              </div>
              <article v-else class="empty-card">当前筛选下没有报告</article>
              <button class="floating-action" type="button" @click="startReport()">
                <ArtSvgIcon icon="ri:upload-cloud-2-line" /> 上传报告
              </button>
            </template>

            <template v-else-if="profileMode === 'upload'">
              <header class="task-detail-heading">
                <button type="button" aria-label="返回报告" @click="cancelReportUpload">
                  <ArtSvgIcon icon="ri:arrow-left-s-line" />
                </button>
                <div>
                  <h1>{{ reportForm.report_id ? '补充报告' : '上传报告' }}</h1>
                </div>
              </header>
              <form class="task-form report-form" @submit.prevent="submitReport">
                <label for="report-task">关联任务（选填）</label>
                <select
                  id="report-task"
                  v-model="reportForm.task_id"
                  :disabled="Boolean(reportForm.report_id)"
                >
                  <option value="">不关联任务</option>
                  <option v-for="task in reportTasks" :key="task.id" :value="task.id">{{
                    `${task.name} · ${task.date}`
                  }}</option>
                </select>
                <label for="report-type">报告类型</label>
                <input
                  id="report-type"
                  v-model.trim="reportForm.type"
                  :disabled="Boolean(reportForm.report_id)"
                  maxlength="100"
                  placeholder="例如：血常规报告"
                />
                <label for="report-date">检查日期</label>
                <input
                  id="report-date"
                  v-model="reportForm.exam_date"
                  :disabled="Boolean(reportForm.report_id)"
                  type="date"
                  :max="homeData.date"
                />
                <label for="report-files">报告图片或 PDF</label>
                <article class="upload-guidance">
                  <ArtSvgIcon icon="ri:focus-3-line" />
                  <span
                    ><strong>拍摄时请将整份报告放入画面</strong
                    ><small>确保文字清晰、页面完整、没有手指或阴影遮挡。</small></span
                  >
                </article>
                <label class="upload-box" for="report-files">
                  <ArtSvgIcon icon="ri:image-add-line" />
                  <strong>{{
                    reportUploads.length ? '继续添加或重新拍摄' : '拍摄或选择报告资料'
                  }}</strong>
                  <small>单份不超过 10MB，最多 10 份</small>
                </label>
                <input
                  id="report-files"
                  class="visually-hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/gif,application/pdf"
                  capture="environment"
                  multiple
                  @change="uploadReportFiles"
                />
                <div v-if="reportUploads.length" class="report-upload-grid">
                  <article v-for="(file, index) in reportUploads" :key="file.url">
                    <a
                      class="report-preview"
                      :href="file.url"
                      target="_blank"
                      rel="noopener"
                      :aria-label="`预览 ${file.name}`"
                    >
                      <img
                        v-if="file.type.startsWith('image/')"
                        :src="file.url"
                        :alt="`${file.name} 预览`"
                      />
                      <span v-else class="report-pdf"
                        ><ArtSvgIcon icon="ri:file-pdf-2-line"
                      /></span>
                    </a>
                    <span :title="file.name">{{ file.name }}</span>
                    <button
                      type="button"
                      :aria-label="`删除 ${file.name}`"
                      @click="removeReportUpload(index)"
                    >
                      <ArtSvgIcon icon="ri:delete-bin-line" />
                    </button>
                  </article>
                </div>
                <label for="report-note">备注（选填）</label>
                <textarea
                  id="report-note"
                  v-model.trim="reportForm.note"
                  rows="3"
                  maxlength="200"
                  placeholder="可补充报告页码或其他说明"
                ></textarea>
                <p v-if="reportError" class="form-error" role="alert">{{ reportError }}</p>
                <button class="wide-primary" type="submit" :disabled="reportSubmitting">
                  {{ reportSubmitting ? '提交中…' : '提交报告' }}
                </button>
              </form>
            </template>

            <template v-else-if="profileMode === 'confirm' && selectedReport">
              <header class="task-detail-heading">
                <button type="button" aria-label="返回报告" @click="profileMode = 'reports'">
                  <ArtSvgIcon icon="ri:arrow-left-s-line" />
                </button>
                <div><h1>核对识别信息</h1><p>提交医生前请确认</p></div>
              </header>
              <form class="task-form report-form" @submit.prevent="confirmReport">
                <p class="form-intro"
                  >系统未生成可信医学指标，请核对报告类型和检查日期；医生仍会查看原图。</p
                >
                <label for="confirm-report-type">报告类型</label>
                <input id="confirm-report-type" v-model.trim="reportConfirm.type" />
                <label for="confirm-report-date">检查日期</label>
                <input
                  id="confirm-report-date"
                  v-model="reportConfirm.exam_date"
                  type="date"
                  :max="homeData.date"
                />
                <div class="metric-heading"
                  ><strong>关键指标（选填）</strong
                  ><button type="button" @click="addMetric">添加指标</button></div
                >
                <div
                  v-for="(metric, index) in reportConfirm.metrics"
                  :key="index"
                  class="metric-row"
                >
                  <div class="metric-fields">
                    <input
                      v-model.trim="metric.name"
                      aria-label="指标名称"
                      placeholder="指标名称"
                    />
                    <input v-model.trim="metric.value" aria-label="检测值" placeholder="检测值" />
                    <input
                      v-model.trim="metric.unit"
                      aria-label="单位"
                      placeholder="单位，如 mg/L"
                    />
                    <input
                      v-model.trim="metric.reference"
                      aria-label="参考范围"
                      placeholder="参考范围"
                    />
                    <select v-model="metric.flag" aria-label="异常标识">
                      <option value="">未标记异常</option>
                      <option value="偏低">偏低</option>
                      <option value="偏高">偏高</option>
                      <option value="异常">异常</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    aria-label="删除指标"
                    @click="reportConfirm.metrics.splice(index, 1)"
                  >
                    <ArtSvgIcon icon="ri:delete-bin-line" />
                  </button>
                </div>
                <small class="metric-note"
                  >请按原报告填写单位、参考范围和异常标识，系统不会据此自动诊断。</small
                >
                <label for="confirm-report-note">核对说明（选填）</label>
                <textarea
                  id="confirm-report-note"
                  v-model.trim="reportConfirm.note"
                  rows="3"
                ></textarea>
                <p v-if="reportError" class="form-error" role="alert">{{ reportError }}</p>
                <button class="wide-primary" type="submit" :disabled="reportSubmitting">
                  {{ reportSubmitting ? '提交中…' : '确认并提交医生核对' }}
                </button>
              </form>
            </template>

            <template v-else-if="profileMode === 'report-detail' && selectedReport">
              <header class="task-detail-heading">
                <button type="button" aria-label="返回报告列表" @click="profileMode = 'reports'">
                  <ArtSvgIcon icon="ri:arrow-left-s-line" />
                </button>
                <div
                  ><h1>报告详情</h1><p>{{ reportStatusText(selectedReport.status) }}</p></div
                >
              </header>
              <article class="report-detail-card">
                <div class="report-title-row">
                  <span class="round-icon blue"><ArtSvgIcon icon="ri:file-chart-line" /></span>
                  <div
                    ><h2>{{ selectedReport.type }}</h2
                    ><span :class="reportStatusClass(selectedReport.status)">{{
                      reportStatusText(selectedReport.status)
                    }}</span></div
                  >
                </div>
                <dl>
                  <div>
                    <dt>检查日期</dt>
                    <dd>{{ selectedReport.exam_date }}</dd>
                  </div>
                  <div>
                    <dt>上传时间</dt>
                    <dd>{{ selectedReport.versions.at(-1)?.time }}</dd>
                  </div>
                  <div>
                    <dt>资料来源</dt>
                    <dd>患者上传</dd>
                  </div>
                </dl>
              </article>
              <article v-if="selectedReport.status === '需补充'" class="supplement-card">
                <strong>补充说明</strong>
                <p>{{ selectedReport.history.at(-1)?.reason || '请补充完整报告资料' }}</p>
              </article>
              <article class="report-files-card">
                <h2>报告原图</h2>
                <p>共 {{ reportFileCount(selectedReport) }} 份，原始资料和补传记录均已保留。</p>
                <ul
                  ><li v-for="file in reportAllFiles(selectedReport)" :key="file.url"
                    ><a :href="file.url" target="_blank" rel="noopener">{{ file.name }}</a></li
                  ></ul
                >
              </article>
              <article v-if="selectedReport.metrics.length" class="report-metrics-card">
                <h2>已核对指标</h2>
                <dl>
                  <div
                    v-for="metric in selectedReport.metrics"
                    :key="`${metric.name}-${metric.value}`"
                  >
                    <dt>{{ metric.name }}</dt>
                    <dd>
                      <strong>{{ metric.value }} {{ metric.unit }}</strong>
                      <small>参考范围：{{ metric.reference || '报告未提供' }}</small>
                      <em v-if="metric.flag">{{ metric.flag }}</em>
                    </dd>
                  </div>
                </dl>
              </article>
              <button
                v-if="selectedReport.status === '需补充'"
                class="floating-action"
                type="button"
                @click="startSupplement(selectedReport)"
                >补充上传</button
              >
              <button
                v-else-if="selectedReport.status === '待患者确认'"
                class="floating-action"
                type="button"
                @click="prepareReportConfirmation(selectedReport)"
                >继续核对</button
              >
            </template>

            <section v-else class="simple-detail">
              <header class="task-detail-heading">
                <button type="button" aria-label="返回我的" @click="profileMode = 'main'">
                  <ArtSvgIcon icon="ri:arrow-left-s-line" />
                </button>
                <div>
                  <h1>{{ supportTitle }}</h1>
                </div>
              </header>
              <article v-if="supportLoading" class="empty-card">正在读取信息</article>
              <template v-else-if="supportData && profileMode === 'reminders'">
                <article class="support-card">
                  <h2>{{ supportData.reminder?.name || '研究组暂未配置提醒方案' }}</h2>
                  <p>{{ supportData.reminder?.description || '如有疑问，请联系随访负责人。' }}</p>
                  <dl v-if="supportData.reminder">
                    <div>
                      <dt>用药提醒</dt>
                      <dd>{{ reminderMedicationText }}</dd>
                    </div>
                    <div>
                      <dt>任务提醒</dt>
                      <dd>{{ reminderTaskText }}</dd>
                    </div>
                    <div>
                      <dt>取药提醒</dt>
                      <dd>{{ reminderPickupText }}</dd>
                    </div>
                  </dl>
                </article>
                <article class="support-card preference-card">
                  <h2>我的消息偏好</h2>
                  <p>只影响消息提醒，首页待办和用药安排会继续保留。</p>
                  <label>
                    <span><strong>用药提醒</strong><small>按研究组设定的服药时点提醒</small></span>
                    <input v-model="supportData.preferences.medication" type="checkbox" />
                  </label>
                  <label>
                    <span
                      ><strong>随访任务提醒</strong><small>任务开始、到期及逾期提醒</small></span
                    >
                    <input v-model="supportData.preferences.tasks" type="checkbox" />
                  </label>
                  <label>
                    <span><strong>取药提醒</strong><small>在预计余药不足前提醒</small></span>
                    <input v-model="supportData.preferences.pickup" type="checkbox" />
                  </label>
                  <button
                    class="wide-primary"
                    type="button"
                    :disabled="supportSaving"
                    @click="saveReminderPreferences"
                    >{{ supportSaving ? '保存中…' : '保存提醒偏好' }}</button
                  >
                </article>
                <p class="support-note">{{ supportData.wechat_subscription.note }}</p>
              </template>
              <template v-else-if="supportData && profileMode === 'contact'">
                <article
                  v-for="contact in supportData.contacts"
                  :key="contact.id"
                  class="support-card contact-card"
                >
                  <span class="round-icon green"
                    ><ArtSvgIcon icon="ri:customer-service-2-line"
                  /></span>
                  <div>
                    <h2>{{ contact.name }}</h2>
                    <p>{{ contact.role }}</p>
                  </div>
                  <a v-if="contact.phone" :href="`tel:${contact.phone}`">{{ contact.phone }}</a>
                  <small v-if="contact.email">{{ contact.email }}</small>
                </article>
                <article v-if="!supportData.contacts.length" class="empty-card">
                  当前没有可展示的联系人
                </article>
              </template>
              <template v-else-if="supportData && profileMode === 'education'">
                <details
                  v-for="article in supportData.articles"
                  :key="article.id"
                  class="support-card article-card"
                >
                  <summary>
                    <span
                      ><strong>{{ article.title }}</strong
                      ><small>{{ article.summary }}</small></span
                    >
                    <ArtSvgIcon icon="ri:arrow-down-s-line" />
                  </summary>
                  <p class="article-content">{{ articleText(article.content) }}</p>
                </details>
                <article v-if="!supportData.articles.length" class="empty-card">
                  当前没有已发布的健康科普
                </article>
              </template>
              <p v-if="supportError" class="form-error" role="alert">{{ supportError }}</p>
            </section>
          </section>

          <div
            v-if="scheduleTask"
            class="schedule-dialog-backdrop"
            @click.self="closeScheduleDialog"
          >
            <section
              class="schedule-dialog"
              role="dialog"
              aria-modal="true"
              :aria-labelledby="`schedule-title-${scheduleTask.id}`"
            >
              <header>
                <span class="round-icon blue">
                  <ArtSvgIcon :icon="taskIcon(scheduleTask.type)" />
                </span>
                <div>
                  <small>{{ scheduleTask.type }}</small>
                  <h2 :id="`schedule-title-${scheduleTask.id}`">{{ scheduleTask.name }}</h2>
                </div>
                <button type="button" aria-label="关闭安排" @click="closeScheduleDialog">
                  <ArtSvgIcon icon="ri:close-line" />
                </button>
              </header>
              <p class="schedule-description">{{
                scheduleTask.description || '请按计划完成本次安排。'
              }}</p>
              <dl>
                <div>
                  <dt>安排日期</dt>
                  <dd>{{ scheduleTask.date }}</dd>
                </div>
                <div>
                  <dt>截止日期</dt>
                  <dd>{{ scheduleTask.due_date }}</dd>
                </div>
              </dl>
              <template v-if="['复诊', '取药', '其他'].includes(scheduleTask.type)">
                <label for="schedule-note">完成情况</label>
                <textarea
                  id="schedule-note"
                  v-model.trim="taskNote"
                  rows="3"
                  maxlength="1000"
                  placeholder="请填写完成日期、地点或其他需要说明的情况"
                ></textarea>
                <button
                  class="wide-primary"
                  type="button"
                  :disabled="taskSubmitting || !taskNote"
                  @click="completeTask"
                >
                  {{ taskSubmitting ? '提交中…' : '确认已完成' }}
                </button>
              </template>
              <template v-else>
                <p class="detail-tip">完成检查后，请上传清晰、完整的报告原图。</p>
                <button class="wide-primary" type="button" @click="startReport(scheduleTask)">
                  上传检查报告
                </button>
              </template>
              <p v-if="taskError" class="form-error" role="alert">{{ taskError }}</p>
            </section>
          </div>

          <nav
            v-if="
              !adverseOpen &&
              !selectedTask &&
              !['upload', 'confirm', 'report-detail'].includes(profileMode)
            "
            class="bottom-nav"
            aria-label="患者端主菜单"
          >
            <button
              v-for="item in navItems"
              :key="item.key"
              :class="{ active: activeTab === item.key }"
              type="button"
              @click="activeTab = item.key"
            >
              <ArtSvgIcon :icon="item.icon" />
              <span>{{ item.label }}</span>
            </button>
          </nav>
        </template>

        <section v-else class="center-state load-error" role="alert">
          <span class="issue-icon"><ArtSvgIcon icon="ri:error-warning-line" /></span>
          <p>{{ errorMessage || '康复计划加载失败' }}</p>
          <button class="primary-button" type="button" @click="loadHome">重新加载</button>
        </section>
      </section>

      <footer v-if="stage === 'identity' || stage === 'medication'" class="sticky-actions">
        <template v-if="issueMode">
          <label for="issue-note">{{
            issueMode === 'identity' ? '请说明哪项资料有误' : '请说明您对用药安排的疑问'
          }}</label>
          <textarea
            id="issue-note"
            v-model.trim="issueNote"
            maxlength="300"
            rows="3"
            placeholder="请尽量写清楚，便于工作人员核对"
          ></textarea>
          <div class="footer-row">
            <button class="secondary-button" type="button" @click="cancelIssue">取消</button>
            <button
              class="primary-button"
              type="button"
              :disabled="submitting || !issueNote"
              @click="submitIssue"
              >提交问题</button
            >
          </div>
        </template>
        <div v-else class="footer-row">
          <button class="secondary-button" type="button" @click="openIssue">
            {{ stage === 'identity' ? '信息有误' : '用药有疑问' }}
          </button>
          <button
            class="primary-button"
            type="button"
            :disabled="submitting || (stage === 'medication' && !allDrugsConfirmed)"
            @click="confirmCurrent"
          >
            {{ stage === 'identity' ? '确认无误，下一步' : '提交确认' }}
          </button>
        </div>
        <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
      </footer>
    </template>
  </main>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
  import medicinePackageImage from '@/assets/images/patient/medicine-package.png'
  import pendingStartImage from '@/assets/images/patient/pending-start.png'

  interface SpeechRecognitionResultLike {
    0: { transcript: string }
  }
  interface SpeechRecognitionEventLike {
    resultIndex: number
    results: ArrayLike<SpeechRecognitionResultLike>
  }
  interface SpeechRecognitionErrorLike {
    error: string
  }
  interface SpeechRecognitionLike {
    lang: string
    continuous: boolean
    interimResults: boolean
    onresult: ((event: SpeechRecognitionEventLike) => void) | null
    onerror: ((event: SpeechRecognitionErrorLike) => void) | null
    onend: (() => void) | null
    start: () => void
    stop: () => void
  }
  type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

  interface PatientDrug {
    drug_id: number
    name: string
    specification: string
    dose: number
    unit: string
    times: string[]
    frequency: string
    precautions: string
    quantity: number
  }
  interface BootstrapData {
    stage:
      | 'identity'
      | 'identity_issue'
      | 'medication'
      | 'medication_issue'
      | 'pending_start'
      | 'home'
    patient: {
      id: number
      patient_code: string
      name: string
      mobile: string
      gender_text: string
      birth_date: string
      project_name: string
      group_name: string
      enroll_date: string
    }
    treatment: null | { id: number | string; drugs: PatientDrug[] }
    medication_start: null | { date: string; time: string; start_at: string }
    identity_confirmation: null | { note: string }
    medication_confirmation: null | { note: string }
  }
  interface MedicationSlot {
    id: string
    date: string
    time: string
    timing: string
    recordable: boolean
    status: 'pending' | 'completed' | 'partial' | 'missed'
    status_text: string
    completed_count: number
    total_count: number
    drugs: Array<{
      plan_id: number
      drug_id: number
      name: string
      specification: string
      dose: number
      unit: string
      status: number
      status_text: string
      record_reason: string
      record_history: Array<{ time: string; operator: string; reason: string }>
    }>
  }
  interface PatientTask {
    id: number | string
    name: string
    type: string
    date: string
    due_date: string
    description: string
    status: string
    source: string
    virtual: boolean
    overdue: boolean
    form: SurveyForm | null
  }
  interface SurveyOption {
    id: number
    label: string
    isExclusive: boolean
    triggerInput: boolean
    inputFields?: Array<{
      field_key: string
      field_label: string
      placeholder?: string
      required: boolean
    }>
  }
  interface SurveyQuestion {
    id: number
    questionNo: number
    title: string
    type: 'RADIO' | 'CHECKBOX' | 'TEXT'
    required: number
    placeholder: string
    options: SurveyOption[]
  }
  interface SurveyForm {
    id: number
    name: string
    description: string
    questions: SurveyQuestion[]
  }
  interface HomeData {
    date: string
    patient: {
      id: number
      name: string
      project_name: string
      group_name: string
      study_state: string
    }
    progress: { current_day: number; total_days: number }
    next_medication: MedicationSlot | null
    medication_today: {
      total_slots: number
      completed_slots: number
      pending_slots: number
      exception_slots: number
    }
    pending_tasks: PatientTask[]
    pending_task_count: number
  }
  interface MedicationData {
    date: string
    slots: MedicationSlot[]
    next_slot: MedicationSlot | null
    history: MedicationSlot[]
    medicines: PatientDrug[]
    stock: Array<{
      drug_id: number
      estimated: number
      days: number
      advance_days: number
      needs_pickup: boolean
      method: string
    }>
  }
  interface TaskData {
    date: string
    tasks: PatientTask[]
  }
  interface SurveyAnswer {
    option_ids: number[]
    text_value: string
    extra_inputs: Record<string, string>
  }
  interface ReportFile {
    url: string
    name: string
    type: string
  }
  interface PatientReport {
    id: number
    task_id: number | null
    type: string
    exam_date: string
    status: string
    ocr_status: string
    metrics: Array<{ name: string; value: string; unit: string; reference: string; flag: string }>
    versions: Array<{ files: ReportFile[]; note: string; time: string; operator: string }>
    history: Array<{ time: string; operator: string; reason: string }>
  }
  interface SupportData {
    reminder: null | {
      name: string
      description: string
      medication_enabled: boolean
      medication_advance_minutes: number
      task_start_enabled: boolean
      task_due_enabled: boolean
      task_overdue_enabled: boolean
      task_remind_time: string
      pickup_enabled: boolean
      pickup_advance_days: number
      pickup_remind_time: string
    }
    preferences: { medication: boolean; tasks: boolean; pickup: boolean }
    wechat_subscription: { available: boolean; authorized: boolean; note: string }
    contacts: Array<{ id: string; name: string; role: string; phone: string; email: string }>
    articles: Array<{
      id: number
      title: string
      summary: string
      content: string
      published_at: string
    }>
  }
  type ProfileMode =
    | 'main'
    | 'reports'
    | 'upload'
    | 'confirm'
    | 'report-detail'
    | 'reminders'
    | 'contact'
    | 'education'
  type MainTab = 'home' | 'medication' | 'tasks' | 'profile'

  const tokenKey = 'tb-patient-token'
  const stage = ref<'loading' | 'login' | BootstrapData['stage']>('loading')
  const mobile = ref('')
  const submitting = ref(false)
  const errorMessage = ref('')
  const data = ref<BootstrapData | null>(null)
  const homeData = ref<HomeData | null>(null)
  const homeLoading = ref(false)
  const activeTab = ref<MainTab>('home')
  const medicationData = ref<MedicationData | null>(null)
  const medicationPanel = ref<'checkin' | 'medicines'>('checkin')
  const medicationError = ref('')
  const medicationSubmittingPlanId = ref<number | null>(null)
  const taskData = ref<TaskData | null>(null)
  const selectedTask = ref<PatientTask | null>(null)
  const scheduleTask = ref<PatientTask | null>(null)
  const taskSubmitting = ref(false)
  const taskError = ref('')
  const feedbackNoDiscomfort = ref<boolean | null>(null)
  const selectedSymptoms = ref<string[]>([])
  const symptomChange = ref('新出现')
  const feedbackNote = ref('')
  const taskNote = ref('')
  const surveyAnswers = ref<Record<number, SurveyAnswer>>({})
  const symptomOptions = [
    '咳嗽',
    '咳痰',
    '发热',
    '盗汗',
    '乏力',
    '食欲下降',
    '体重下降',
    '胸闷气短',
    '其他'
  ]
  const symptomChanges = ['首次记录', '减轻', '无变化', '加重', '新出现', '消失']
  const speechSupported = ref(false)
  const speechListening = ref(false)
  const speechMessage = ref('')
  let speechRecognition: SpeechRecognitionLike | null = null
  const adverseOpen = ref(false)
  const adverseSubmitted = ref(false)
  const adverseSubmitting = ref(false)
  const adverseError = ref('')
  const adverseSymptomOptions = [
    '皮肤瘙痒',
    '皮疹',
    '恶心呕吐',
    '腹泻腹痛',
    '关节痛',
    '视力模糊',
    '头痛头晕',
    '发热',
    '其他'
  ]
  const adverseSeverityOptions = [
    { value: 1, label: '轻度' },
    { value: 2, label: '中度' },
    { value: 3, label: '重度' }
  ]
  const adverseForm = ref({
    occurred_at: '',
    symptoms: [] as string[],
    description: '',
    severity: 0
  })
  const profileMode = ref<ProfileMode>('main')
  const supportData = ref<SupportData | null>(null)
  const supportLoading = ref(false)
  const supportSaving = ref(false)
  const supportError = ref('')
  const reports = ref<PatientReport[]>([])
  const reportFilter = ref('')
  const reportFilters = [
    { label: '全部', value: '' },
    { label: '需补充', value: '需补充' },
    { label: '待核对', value: '待核对' },
    { label: '已核对', value: '已核对' }
  ]
  const selectedReport = ref<PatientReport | null>(null)
  const reportUploads = ref<ReportFile[]>([])
  const reportSubmitting = ref(false)
  const reportError = ref('')
  const reportForm = ref({
    report_id: 0,
    task_id: '' as number | string,
    type: '',
    exam_date: '',
    note: ''
  })
  const reportConfirm = ref({
    type: '',
    exam_date: '',
    note: '',
    metrics: [] as Array<{
      name: string
      value: string
      unit: string
      reference: string
      flag: string
    }>
  })
  const confirmedDrugs = ref<number[]>([])
  const issueMode = ref<null | 'identity' | 'medication'>(null)
  const issueNote = ref('')
  const navItems: Array<{ key: MainTab; label: string; icon: string }> = [
    { key: 'home', label: '首页', icon: 'ri:home-5-line' },
    { key: 'medication', label: '用药', icon: 'ri:medicine-bottle-line' },
    { key: 'tasks', label: '任务', icon: 'ri:stack-line' },
    { key: 'profile', label: '我的', icon: 'ri:user-line' }
  ]

  const isIdentityStage = computed(
    () => stage.value === 'identity' || stage.value === 'identity_issue'
  )
  const isMedicationStage = computed(
    () => stage.value === 'medication' || stage.value === 'medication_issue'
  )
  const allDrugsConfirmed = computed(() =>
    Boolean(
      data.value?.treatment?.drugs.length &&
      data.value.treatment.drugs.every((drug) => confirmedDrugs.value.includes(drug.drug_id))
    )
  )
  const medicationStartDateText = computed(() => {
    const date = data.value?.medication_start?.date
    if (!date) return '--'
    const [year, month, day] = date.split('-').map(Number)
    return `${year}年${month}月${day}日`
  })
  const medicationStartTimeText = computed(() => {
    const time = data.value?.medication_start?.time
    if (!time) return '--:--'
    const hour = Number(time.slice(0, 2))
    const period = hour < 6 ? '凌晨' : hour < 12 ? '上午' : hour < 18 ? '下午' : '晚上'
    return `${period} ${time}`
  })
  const filteredReports = computed(() =>
    reports.value.filter((report) => {
      if (!reportFilter.value) return true
      if (reportFilter.value === '待核对') return ['待患者确认', '待核对'].includes(report.status)
      return report.status === reportFilter.value
    })
  )
  const pendingMedicationSlots = computed(() =>
    (medicationData.value?.slots || []).filter(
      (slot) => slot.status === 'pending' && slot.drugs.some((drug) => drug.status === 0)
    )
  )
  const medicationCompletionPercentage = computed(() => {
    const total = homeData.value?.medication_today.total_slots || 0
    if (!total) return 0
    return Math.round(((homeData.value?.medication_today.completed_slots || 0) / total) * 100)
  })
  const reportTasks = computed(() =>
    (taskData.value?.tasks || []).filter((task) => ['检查', '报告提交'].includes(task.type))
  )
  const adverseMaxTime = computed(() => defaultAdverseTime())
  const supportTitle = computed(() => {
    if (profileMode.value === 'reminders') return '提醒设置'
    if (profileMode.value === 'education') return '健康科普'
    return '联系药师 / 医院'
  })
  const reminderMedicationText = computed(() => {
    const reminder = supportData.value?.reminder
    if (!reminder?.medication_enabled) return '未开启'
    return reminder.medication_advance_minutes
      ? `服药前 ${reminder.medication_advance_minutes} 分钟`
      : '按服药时点提醒'
  })
  const reminderTaskText = computed(() => {
    const reminder = supportData.value?.reminder
    if (!reminder) return '未配置'
    const stages = [
      reminder.task_start_enabled ? '开始' : '',
      reminder.task_due_enabled ? '到期' : '',
      reminder.task_overdue_enabled ? '逾期' : ''
    ].filter(Boolean)
    return stages.length ? `${stages.join('、')} · ${reminder.task_remind_time}` : '未开启'
  })
  const reminderPickupText = computed(() => {
    const reminder = supportData.value?.reminder
    if (!reminder?.pickup_enabled) return '未开启'
    return `预计不足前 ${reminder.pickup_advance_days} 天 · ${reminder.pickup_remind_time}`
  })
  const adverseGuidance = computed(() => {
    if (adverseForm.value.severity === 3) {
      return {
        title: '紧急提示',
        text: '您选择的症状较为严重，请立即停药并前往医院就诊，请勿等待在线回复。'
      }
    }
    if (adverseForm.value.severity === 2) {
      return {
        title: '温馨提示',
        text: '请密切观察症状，并尽快联系随访医生，由医生判断是否需要检查或调整用药。'
      }
    }
    return {
      title: '温馨提示',
      text: '症状较轻时可先继续观察并按要求上报；如症状加重或持续不缓解，请及时联系随访医生。'
    }
  })

  async function api<T>(
    path: string,
    options: { method?: string; body?: string | FormData } = {},
    token = sessionStorage.getItem(tokenKey) || ''
  ) {
    const formData = options.body instanceof FormData
    const response = await fetch(`/api${path}`, {
      ...options,
      headers: {
        ...(options.body && !formData ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })
    const result = await response.json()
    if (result.code !== 0) throw new Error(result.message || '请求失败，请稍后重试')
    return result.data as T
  }
  function applyBootstrap(result: BootstrapData) {
    data.value = result
    stage.value = result.stage
    confirmedDrugs.value = []
    issueMode.value = null
    issueNote.value = ''
    errorMessage.value = ''
    if (result.stage === 'home') void loadHome()
  }
  async function loadHome() {
    homeLoading.value = true
    errorMessage.value = ''
    try {
      homeData.value = await api<HomeData>('/app/patient/home')
      await Promise.all([loadMedication(), loadTasks()])
    } catch (error) {
      homeData.value = null
      errorMessage.value = error instanceof Error ? error.message : '康复计划加载失败，请稍后重试'
    } finally {
      homeLoading.value = false
    }
  }
  async function loadMedication() {
    medicationError.value = ''
    try {
      medicationData.value = await api<MedicationData>('/app/patient/medication')
    } catch (error) {
      medicationData.value = null
      medicationError.value = error instanceof Error ? error.message : '用药安排加载失败'
    }
  }
  async function loadTasks() {
    taskError.value = ''
    try {
      taskData.value = await api<TaskData>('/app/patient/tasks')
    } catch (error) {
      taskData.value = null
      taskError.value = error instanceof Error ? error.message : '任务加载失败'
    }
  }
  async function loadSupport() {
    supportLoading.value = true
    supportError.value = ''
    try {
      supportData.value = await api<SupportData>('/app/patient/support')
    } catch (error) {
      supportData.value = null
      supportError.value = error instanceof Error ? error.message : '信息加载失败'
    } finally {
      supportLoading.value = false
    }
  }
  function openSupport(mode: Extract<ProfileMode, 'reminders' | 'contact' | 'education'>) {
    profileMode.value = mode
    void loadSupport()
  }
  async function saveReminderPreferences() {
    if (!supportData.value) return
    supportSaving.value = true
    supportError.value = ''
    try {
      supportData.value = await api<SupportData>('/app/patient/reminder-preferences', {
        method: 'POST',
        body: JSON.stringify(supportData.value.preferences)
      })
    } catch (error) {
      supportError.value = error instanceof Error ? error.message : '提醒偏好保存失败'
    } finally {
      supportSaving.value = false
    }
  }
  function articleText(content: string) {
    return content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  async function loadBootstrap() {
    try {
      applyBootstrap(await api<BootstrapData>('/app/patient/bootstrap'))
    } catch (error) {
      sessionStorage.removeItem(tokenKey)
      stage.value = 'login'
      errorMessage.value = error instanceof Error ? error.message : '登录已过期，请重新登录'
    }
  }
  async function login() {
    if (!/^1\d{10}$/.test(mobile.value)) {
      errorMessage.value = '请输入正确的 11 位手机号'
      return
    }
    submitting.value = true
    errorMessage.value = ''
    try {
      const result = await api<{ token: { access_token: string } }>(
        '/app/login',
        {
          method: 'POST',
          body: JSON.stringify({ mobile: mobile.value })
        },
        ''
      )
      sessionStorage.setItem(tokenKey, result.token.access_token)
      await loadBootstrap()
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '登录失败，请稍后重试'
    } finally {
      submitting.value = false
    }
  }
  async function logout() {
    stopSpeechInput()
    const token = sessionStorage.getItem(tokenKey) || ''
    sessionStorage.removeItem(tokenKey)
    stage.value = 'login'
    data.value = null
    homeData.value = null
    medicationData.value = null
    taskData.value = null
    selectedTask.value = null
    scheduleTask.value = null
    adverseOpen.value = false
    reports.value = []
    selectedReport.value = null
    supportData.value = null
    profileMode.value = 'main'
    activeTab.value = 'home'
    mobile.value = ''
    errorMessage.value = ''
    try {
      await api('/app/logout', { method: 'POST', body: '{}' }, token)
    } catch {
      // 本地登录状态已清除，无需阻塞退出。
    }
  }
  function toggleDrug(id: number) {
    confirmedDrugs.value = confirmedDrugs.value.includes(id)
      ? confirmedDrugs.value.filter((item) => item !== id)
      : [...confirmedDrugs.value, id]
  }
  function openIssue() {
    issueMode.value = stage.value === 'identity' ? 'identity' : 'medication'
    issueNote.value = ''
    errorMessage.value = ''
  }
  function cancelIssue() {
    issueMode.value = null
    issueNote.value = ''
  }
  async function postConfirmation(path: string, body: object) {
    submitting.value = true
    errorMessage.value = ''
    try {
      applyBootstrap(await api<BootstrapData>(path, { method: 'POST', body: JSON.stringify(body) }))
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '提交失败，请稍后重试'
    } finally {
      submitting.value = false
    }
  }
  function confirmCurrent() {
    if (stage.value === 'identity') {
      void postConfirmation('/app/patient/confirm-identity', { confirmed: true })
    } else if (stage.value === 'medication' && data.value?.treatment) {
      void postConfirmation('/app/patient/confirm-medication', {
        confirmed: true,
        treatment_id: data.value.treatment.id
      })
    }
  }
  function submitIssue() {
    if (!issueNote.value) return
    if (issueMode.value === 'identity') {
      void postConfirmation('/app/patient/confirm-identity', {
        confirmed: false,
        note: issueNote.value
      })
    } else if (issueMode.value === 'medication' && data.value?.treatment) {
      void postConfirmation('/app/patient/confirm-medication', {
        confirmed: false,
        note: issueNote.value,
        treatment_id: data.value.treatment.id
      })
    }
  }
  function medicationDateLabel(date: string) {
    if (date === homeData.value?.date) return '下一次服药时间'
    return `${date.slice(5).replace('-', '月')}日服药时间`
  }
  function pendingDrugs(slot: MedicationSlot) {
    return slot.drugs.filter((drug) => drug.status === 0)
  }
  function medicationPeriodLabel(time: string) {
    const hour = Number(time.slice(0, 2))
    if (hour < 10) return '早晨'
    if (hour < 14) return '中午'
    if (hour < 18) return '下午'
    return '晚上'
  }
  function medicationTimingLabel(slot: MedicationSlot) {
    if (!slot.timing || !['餐前', '餐后'].includes(slot.timing)) return slot.timing || '按医嘱'
    const hour = Number(slot.time.slice(0, 2))
    const meal = hour < 10 ? '早餐' : hour < 15 ? '午餐' : '晚餐'
    return `${meal}${slot.timing.slice(1)}`
  }
  function drugStock(drugId: number) {
    return medicationData.value?.stock.find((row) => row.drug_id === drugId)
  }
  async function recordMedicationDrug(planId: number) {
    medicationSubmittingPlanId.value = planId
    medicationError.value = ''
    try {
      medicationData.value = await api<MedicationData>('/app/patient/medication-checkin', {
        method: 'POST',
        body: JSON.stringify({ id: planId })
      })
      homeData.value = await api<HomeData>('/app/patient/home')
    } catch (error) {
      medicationError.value =
        error instanceof Error ? error.message : '服药记录提交失败，请稍后重试'
    } finally {
      medicationSubmittingPlanId.value = null
    }
  }
  function taskTimeText(task: PatientTask) {
    if (task.due_date === homeData.value?.date) return '今日完成'
    return `${task.overdue ? '已逾期' : '截止'}：${task.due_date}`
  }
  function taskIcon(type: string) {
    if (type === '健康反馈') return 'ri:mic-line'
    if (type === '问卷') return 'ri:file-list-3-line'
    if (type === '取药') return 'ri:capsule-line'
    if (type === '报告提交') return 'ri:file-upload-line'
    if (type === '复诊') return 'ri:hospital-line'
    return 'ri:calendar-check-line'
  }
  function taskAction(type: string) {
    if (type === '健康反馈') return '开始反馈'
    if (type === '问卷') return '填写问卷'
    if (type === '报告提交') return '补充报告'
    if (type === '取药') return '查看提醒'
    return '查看安排'
  }
  function openTask(task: PatientTask) {
    stopSpeechInput()
    taskError.value = ''
    taskNote.value = ''
    if (!['健康反馈', '问卷'].includes(task.type)) {
      scheduleTask.value = task
      selectedTask.value = null
      return
    }
    scheduleTask.value = null
    selectedTask.value = task
    feedbackNoDiscomfort.value = null
    selectedSymptoms.value = []
    symptomChange.value = '新出现'
    feedbackNote.value = ''
    speechMessage.value = ''
    surveyAnswers.value = Object.fromEntries(
      (task.form?.questions || []).map((question) => [
        question.id,
        { option_ids: [], text_value: '', extra_inputs: {} }
      ])
    )
  }
  function closeTask() {
    stopSpeechInput()
    selectedTask.value = null
    taskError.value = ''
  }
  function closeScheduleDialog() {
    scheduleTask.value = null
    taskNote.value = ''
    taskError.value = ''
  }
  function setDiscomfort(hasDiscomfort: boolean) {
    feedbackNoDiscomfort.value = !hasDiscomfort
    if (!hasDiscomfort) selectedSymptoms.value = []
  }
  function toggleSymptom(symptom: string) {
    selectedSymptoms.value = selectedSymptoms.value.includes(symptom)
      ? selectedSymptoms.value.filter((item) => item !== symptom)
      : [...selectedSymptoms.value, symptom]
  }
  function stopSpeechInput() {
    if (!speechRecognition || !speechListening.value) return
    speechRecognition.stop()
    speechListening.value = false
  }
  function toggleSpeechInput() {
    if (speechListening.value) {
      stopSpeechInput()
      speechMessage.value = '已停止识别，请核对转换后的文字。'
      return
    }
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!Recognition) {
      speechSupported.value = false
      return
    }
    speechRecognition = new Recognition()
    speechRecognition.lang = 'zh-CN'
    speechRecognition.continuous = false
    speechRecognition.interimResults = false
    speechRecognition.onresult = (event) => {
      let transcript = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index]?.[0]?.transcript || ''
      }
      const text = transcript.trim()
      if (text) {
        feedbackNote.value = `${feedbackNote.value}${feedbackNote.value ? '\n' : ''}${text}`
        speechMessage.value = '已转成文字，请核对后再提交。'
      }
    }
    speechRecognition.onerror = (event) => {
      speechListening.value = false
      speechMessage.value =
        event.error === 'not-allowed'
          ? '未获得麦克风权限，请允许后重试或直接输入文字。'
          : '没有听清，请重试或直接输入文字。'
    }
    speechRecognition.onend = () => {
      speechListening.value = false
    }
    try {
      speechRecognition.start()
      speechListening.value = true
      speechMessage.value = '正在倾听，请说出需要补充的情况…'
    } catch {
      speechListening.value = false
      speechMessage.value = '语音识别暂时无法启动，请直接输入文字。'
    }
  }
  function toggleSurveyOption(question: SurveyQuestion, optionId: number) {
    const answer = surveyAnswers.value[question.id]
    if (question.type === 'RADIO') {
      answer.option_ids = [optionId]
      return
    }
    if (answer.option_ids.includes(optionId)) {
      answer.option_ids = answer.option_ids.filter((id) => id !== optionId)
      return
    }
    const option = question.options.find((item) => item.id === optionId)
    answer.option_ids = option?.isExclusive
      ? [optionId]
      : [
          ...answer.option_ids.filter(
            (id) => !question.options.find((item) => item.id === id)?.isExclusive
          ),
          optionId
        ]
  }
  async function refreshTaskSummary(tasks: PatientTask[]) {
    if (taskData.value) taskData.value.tasks = tasks
    homeData.value = await api<HomeData>('/app/patient/home')
    selectedTask.value = null
    scheduleTask.value = null
  }
  async function submitFeedback() {
    if (feedbackNoDiscomfort.value === null) {
      taskError.value = '请选择今天是否有身体不适'
      return
    }
    if (!feedbackNoDiscomfort.value && !selectedSymptoms.value.length) {
      taskError.value = '请至少选择一种症状'
      return
    }
    stopSpeechInput()
    taskSubmitting.value = true
    taskError.value = ''
    try {
      const result = await api<{ tasks: PatientTask[] }>('/app/patient/feedback', {
        method: 'POST',
        body: JSON.stringify({
          no_discomfort: feedbackNoDiscomfort.value,
          symptoms: selectedSymptoms.value.map((name) => ({ name, change: symptomChange.value })),
          note: feedbackNote.value
        })
      })
      await refreshTaskSummary(result.tasks)
    } catch (error) {
      taskError.value = error instanceof Error ? error.message : '健康反馈提交失败'
    } finally {
      taskSubmitting.value = false
    }
  }
  async function submitSurvey() {
    if (!selectedTask.value) return
    taskSubmitting.value = true
    taskError.value = ''
    try {
      const answers = Object.entries(surveyAnswers.value).map(([questionId, answer]) => ({
        question_id: Number(questionId),
        ...answer
      }))
      const result = await api<{ tasks: PatientTask[] }>('/app/patient/survey-submit', {
        method: 'POST',
        body: JSON.stringify({ task_id: selectedTask.value.id, answers })
      })
      await refreshTaskSummary(result.tasks)
    } catch (error) {
      taskError.value = error instanceof Error ? error.message : '问卷提交失败'
    } finally {
      taskSubmitting.value = false
    }
  }
  async function completeTask() {
    if (!scheduleTask.value || !taskNote.value) return
    taskSubmitting.value = true
    taskError.value = ''
    try {
      const result = await api<{ tasks: PatientTask[] }>('/app/patient/task-complete', {
        method: 'POST',
        body: JSON.stringify({ task_id: scheduleTask.value.id, note: taskNote.value })
      })
      await refreshTaskSummary(result.tasks)
    } catch (error) {
      taskError.value = error instanceof Error ? error.message : '任务提交失败'
    } finally {
      taskSubmitting.value = false
    }
  }
  async function loadReports() {
    reportError.value = ''
    try {
      reports.value = (await api<{ reports: PatientReport[] }>('/app/patient/reports')).reports
    } catch (error) {
      reportError.value = error instanceof Error ? error.message : '报告加载失败'
    }
  }
  async function openReports() {
    profileMode.value = 'reports'
    await loadReports()
  }
  function startReport(task?: PatientTask) {
    activeTab.value = 'profile'
    profileMode.value = 'upload'
    selectedTask.value = null
    scheduleTask.value = null
    selectedReport.value = null
    reportUploads.value = []
    reportError.value = ''
    reportForm.value = {
      report_id: 0,
      task_id: task?.id || '',
      type: task ? '检查报告' : '',
      exam_date: homeData.value?.date || '',
      note: ''
    }
  }
  function startSupplement(report: PatientReport) {
    profileMode.value = 'upload'
    selectedReport.value = report
    reportUploads.value = []
    reportError.value = ''
    reportForm.value = {
      report_id: report.id,
      task_id: '',
      type: report.type,
      exam_date: report.exam_date,
      note: ''
    }
  }
  function cancelReportUpload() {
    profileMode.value = 'reports'
    reportUploads.value = []
    reportError.value = ''
  }
  async function uploadReportFiles(event: Event) {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files || [])
    if (reportUploads.value.length + files.length > 10) {
      reportError.value = '每次最多上传10份报告'
      input.value = ''
      return
    }
    reportSubmitting.value = true
    reportError.value = ''
    try {
      for (const file of files) {
        const body = new FormData()
        body.append('file', file)
        reportUploads.value.push(
          await api<ReportFile>('/app/patient/file-upload', { method: 'POST', body })
        )
      }
    } catch (error) {
      reportError.value = error instanceof Error ? error.message : '报告资料上传失败'
    } finally {
      reportSubmitting.value = false
      input.value = ''
    }
  }
  function removeReportUpload(index: number) {
    reportUploads.value.splice(index, 1)
    reportError.value = ''
  }
  function prepareReportConfirmation(report: PatientReport) {
    selectedReport.value = report
    reportConfirm.value = {
      type: report.type,
      exam_date: report.exam_date,
      note: '',
      metrics: report.metrics.map((metric) => ({ ...metric, flag: metric.flag || '' }))
    }
    profileMode.value = 'confirm'
    reportError.value = ''
  }
  async function submitReport() {
    if (!reportUploads.value.length) {
      reportError.value = '请至少添加一份报告资料'
      return
    }
    reportSubmitting.value = true
    reportError.value = ''
    try {
      const report = await api<PatientReport>('/app/patient/report-submit', {
        method: 'POST',
        body: JSON.stringify({
          ...reportForm.value,
          files: reportUploads.value.map((file) => file.url)
        })
      })
      prepareReportConfirmation(report)
      await loadReports()
    } catch (error) {
      reportError.value = error instanceof Error ? error.message : '报告提交失败'
    } finally {
      reportSubmitting.value = false
    }
  }
  function addMetric() {
    reportConfirm.value.metrics.push({ name: '', value: '', unit: '', reference: '', flag: '' })
  }
  async function confirmReport() {
    if (!selectedReport.value) return
    reportSubmitting.value = true
    reportError.value = ''
    try {
      selectedReport.value = await api<PatientReport>('/app/patient/report-confirm', {
        method: 'POST',
        body: JSON.stringify({ id: selectedReport.value.id, ...reportConfirm.value })
      })
      await Promise.all([loadReports(), loadTasks()])
      homeData.value = await api<HomeData>('/app/patient/home')
      profileMode.value = 'report-detail'
    } catch (error) {
      reportError.value = error instanceof Error ? error.message : '报告核对提交失败'
    } finally {
      reportSubmitting.value = false
    }
  }
  async function openReportDetail(id: number) {
    reportError.value = ''
    try {
      selectedReport.value = await api<PatientReport>(
        '/app/patient/report-detail?' + new URLSearchParams({ id: String(id) })
      )
      profileMode.value = selectedReport.value.status === '待患者确认' ? 'confirm' : 'report-detail'
      if (profileMode.value === 'confirm') prepareReportConfirmation(selectedReport.value)
    } catch (error) {
      reportError.value = error instanceof Error ? error.message : '报告详情加载失败'
    }
  }
  function reportStatusText(status: string) {
    return status === '待患者确认' ? '待确认' : status
  }
  function reportStatusClass(status: string) {
    if (status === '已核对') return 'status-reviewed'
    if (status === '需补充') return 'status-supplement'
    return 'status-pending'
  }
  function reportAllFiles(report: PatientReport) {
    return report.versions.flatMap((version) => version.files)
  }
  function reportFileCount(report: PatientReport) {
    return reportAllFiles(report).length
  }
  function defaultAdverseTime() {
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    return `${homeData.value?.date || ''}T${hours}:${minutes}`
  }
  function openAdverseReport() {
    adverseForm.value = {
      occurred_at: defaultAdverseTime(),
      symptoms: [],
      description: '',
      severity: 0
    }
    adverseError.value = ''
    adverseSubmitted.value = false
    adverseOpen.value = true
  }
  function closeAdverseReport() {
    adverseOpen.value = false
    adverseSubmitted.value = false
    adverseError.value = ''
  }
  function toggleAdverseSymptom(symptom: string) {
    adverseForm.value.symptoms = adverseForm.value.symptoms.includes(symptom)
      ? adverseForm.value.symptoms.filter((item) => item !== symptom)
      : [...adverseForm.value.symptoms, symptom]
  }
  async function submitAdverseReport() {
    if (!adverseForm.value.occurred_at) {
      adverseError.value = '请选择症状发生时间'
      return
    }
    if (!adverseForm.value.symptoms.length) {
      adverseError.value = '请至少选择一种主要症状'
      return
    }
    if (!adverseForm.value.description) {
      adverseError.value = '请填写症状描述'
      return
    }
    if (!adverseForm.value.severity) {
      adverseError.value = '请选择严重程度'
      return
    }
    adverseSubmitting.value = true
    adverseError.value = ''
    try {
      await api('/app/patient/adverse-report', {
        method: 'POST',
        body: JSON.stringify({
          ...adverseForm.value,
          occurred_at: `${adverseForm.value.occurred_at.replace('T', ' ')}:00`
        })
      })
      adverseSubmitted.value = true
    } catch (error) {
      adverseError.value = error instanceof Error ? error.message : '上报失败，请稍后重试'
    } finally {
      adverseSubmitting.value = false
    }
  }

  onMounted(() => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    speechSupported.value = Boolean(
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    )
    if (sessionStorage.getItem(tokenKey)) void loadBootstrap()
    else stage.value = 'login'
  })
  onBeforeUnmount(stopSpeechInput)
</script>

<style scoped>
  :global(html),
  :global(body),
  :global(#app) {
    min-height: 100%;
  }

  :global(body) {
    margin: 0;
    background: #dfe6ef;
  }

  button,
  input,
  textarea {
    font: inherit;
  }

  button {
    -webkit-tap-highlight-color: transparent;
  }

  .patient-app {
    position: relative;
    box-sizing: border-box;
    width: min(100%, 390px);
    min-height: 100dvh;
    margin: 0 auto;
    overflow-x: hidden;
    color: #151922;
    background: #f1f5fb;
    box-shadow: 0 0 40px rgb(51 68 90 / 16%);
  }

  .patient-app.is-login {
    background: #edf4ff;
  }

  .page-header {
    display: grid;
    grid-template-columns: 44px 1fr 44px;
    align-items: center;
    padding: max(14px, env(safe-area-inset-top)) 16px 8px;
  }

  .page-header h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    text-align: center;
  }

  .icon-button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    font-size: 28px;
    color: #141922;
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  .flow-page {
    padding: 4px 18px 152px;
  }

  .step-copy > p {
    margin: 12px 4px;
    font-size: 15px;
    line-height: 1.6;
  }

  .step-copy strong {
    font-size: 21px;
    font-weight: 500;
    color: #2468ff;
  }

  .progress-track {
    height: 4px;
    margin: 0 4px 20px;
    overflow: hidden;
    background: #d5e4ff;
    border-radius: 99px;
  }

  .progress-track span {
    display: block;
    height: 100%;
    background: #3b82f6;
    border-radius: inherit;
  }

  .info-card,
  .study-card,
  .medicine-card,
  .issue-state,
  .login-card {
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 8px 28px rgb(62 86 126 / 6%);
  }

  .info-card {
    padding: 18px 14px 8px;
  }

  .info-card h2,
  .medicine-card h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 650;
  }

  .identity-list {
    margin: 12px 0 0;
  }

  .identity-list > div {
    display: grid;
    grid-template-columns: 86px 1fr;
    align-items: center;
    min-height: 54px;
    border-top: 1px solid #f0f2f5;
  }

  .identity-list dt {
    color: #6c7481;
  }

  .identity-list dd {
    margin: 0;
    font-weight: 500;
  }

  .study-card {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 16px;
    margin-top: 12px;
  }

  .study-card span,
  .study-card small,
  .medicine-card small {
    color: #818895;
  }

  .study-card strong {
    line-height: 1.45;
  }

  .medication-page {
    padding-right: 16px;
    padding-left: 16px;
  }

  .medicine-card {
    padding: 14px 12px 12px;
    margin-bottom: 12px;
  }

  .medicine-main {
    display: grid;
    grid-template-columns: 70px 1fr;
    gap: 12px;
    align-items: center;
    min-height: 88px;
  }

  .medicine-icon {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    font-size: 34px;
    color: #3172ed;
    background: #eef5ff;
    border-radius: 12px;
  }

  .medicine-card p {
    display: flex;
    gap: 10px;
    margin: 7px 0;
    font-size: 14px;
    color: #5f6672;
  }

  .medicine-card p strong {
    font-weight: 500;
    color: #2168f3;
  }

  .drug-confirm-button {
    display: flex;
    gap: 5px;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 44px;
    color: #276cf0;
    cursor: pointer;
    background: #dfebff;
    border: 0;
    border-radius: 9px;
  }

  .drug-confirm-button.confirmed {
    color: #247a4c;
    background: #e8f7ee;
  }

  .issue-state {
    padding: 32px 22px;
    text-align: center;
  }

  .issue-state h2 {
    margin: 16px 0 8px;
    font-size: 20px;
  }

  .issue-state p {
    margin: 0;
    line-height: 1.7;
    color: #6a7280;
  }

  .issue-icon,
  .success-icon {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    margin: 0 auto;
    font-size: 32px;
    color: #2468ff;
    background: #e9f1ff;
    border-radius: 50%;
  }

  .issue-note {
    padding: 12px;
    margin-top: 20px;
    line-height: 1.55;
    color: #4c5564;
    text-align: left;
    background: #f4f6f9;
    border-radius: 10px;
  }

  .sticky-actions {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 5;
    box-sizing: border-box;
    width: min(100%, 390px);
    padding: 12px 20px max(14px, env(safe-area-inset-bottom));
    margin: 0 auto;
    background: rgb(255 255 255 / 96%);
    backdrop-filter: blur(12px);
    border-top: 1px solid #edf0f5;
  }

  .sticky-actions label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
  }

  .sticky-actions textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 10px 12px;
    margin-bottom: 10px;
    resize: none;
    background: #f4f6f9;
    border: 1px solid transparent;
    border-radius: 10px;
    outline: 0;
  }

  .sticky-actions textarea:focus {
    border-color: #4f8bff;
  }

  .footer-row {
    display: grid;
    grid-template-columns: 116px 1fr;
    gap: 10px;
  }

  .primary-button,
  .secondary-button {
    min-height: 48px;
    padding: 0 14px;
    font-weight: 600;
    cursor: pointer;
    border-radius: 12px;
  }

  .primary-button {
    color: #fff;
    background: #2468ff;
    border: 1px solid #2468ff;
  }

  .primary-button:disabled {
    cursor: not-allowed;
    background: #9ebcff;
    border-color: #9ebcff;
  }

  .secondary-button {
    color: #526071;
    background: #fff;
    border: 1px solid #dce2ea;
  }

  .form-error {
    margin: 10px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: #d84b45;
  }

  .center-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    padding: 32px;
    text-align: center;
  }

  .loading-icon {
    font-size: 32px;
    color: #2468ff;
    animation: spin 0.8s linear infinite;
  }

  .success-state h1 {
    margin: 20px 0 8px;
  }

  .success-state p {
    margin: 0 0 10px;
    color: #4d5766;
  }

  .success-state small {
    max-width: 270px;
    line-height: 1.6;
    color: #858d99;
  }

  .success-icon {
    color: #fff;
    background: #35b76f;
  }

  .pending-start-page {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    padding: max(14px, env(safe-area-inset-top)) 18px max(28px, env(safe-area-inset-bottom));
    background: #f1f5fb;
  }

  .pending-start-header {
    display: grid;
    place-items: center;
    min-height: 44px;
  }

  .pending-start-header h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 650;
  }

  .pending-start-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .pending-start-status img {
    width: 176px;
    height: 176px;
    margin: 32px 0 12px;
    object-fit: contain;
  }

  .pending-start-status h2 {
    margin: 0;
    font-size: 27px;
    font-weight: 700;
    line-height: 1.35;
    letter-spacing: -0.4px;
  }

  .pending-start-status p {
    margin: 8px 0 0;
    font-size: 17px;
    color: #687180;
  }

  .pending-start-time-card {
    padding: 18px 17px 17px;
    margin-top: 24px;
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 8px 28px rgb(62 86 126 / 5%);
  }

  .pending-start-label {
    display: block;
    margin-bottom: 9px;
    font-size: 16px;
    font-weight: 650;
  }

  .pending-start-date-row {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
  }

  .pending-start-date-row strong {
    min-width: 0;
    font-size: 29px;
    font-weight: 500;
    line-height: 1.25;
    color: #2468ff;
    letter-spacing: -0.8px;
  }

  .pending-start-date-row span {
    flex: 0 0 auto;
    padding: 7px 13px;
    font-size: 13px;
    color: #2468ff;
    background: #eaf2ff;
    border-radius: 99px;
  }

  .pending-start-time-card time {
    display: block;
    margin-top: 6px;
    font-size: 18px;
    color: #687180;
  }

  .pending-start-guidance {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 12px;
    padding: 18px 16px;
    margin-top: 16px;
    background: #e9f3ff;
    border-radius: 14px;
  }

  .pending-start-info {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    font-size: 24px;
    color: #fff;
    background: #2468ff;
    border-radius: 50%;
    box-shadow: 0 0 0 8px rgb(36 104 255 / 10%);
  }

  .pending-start-guidance h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 650;
  }

  .pending-start-guidance p {
    margin: 7px 0 0;
    font-size: 14px;
    line-height: 1.65;
    color: #667284;
  }

  .pending-start-note {
    margin: auto 0 0;
    padding-top: 24px;
    font-size: 12px;
    line-height: 1.5;
    color: #929aa7;
    text-align: center;
  }

  @media (max-width: 350px) {
    .pending-start-status img {
      width: 150px;
      height: 150px;
      margin-top: 22px;
    }

    .pending-start-status h2 {
      font-size: 24px;
    }

    .pending-start-date-row strong {
      font-size: 25px;
    }
  }

  .login-page {
    min-height: 100dvh;
    padding: max(72px, calc(env(safe-area-inset-top) + 52px)) 22px 30px;
  }

  .login-brand {
    margin-bottom: 34px;
  }

  .brand-icon {
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    margin-bottom: 18px;
    font-size: 30px;
    color: #fff;
    background: #2468ff;
    border-radius: 16px;
    box-shadow: 0 10px 24px rgb(36 104 255 / 25%);
  }

  .brand-icon :deep(svg),
  .medicine-icon :deep(svg),
  .issue-icon :deep(svg),
  .success-icon :deep(svg) {
    width: 1em;
    height: 1em;
  }

  .login-brand p {
    margin: 0 0 10px;
    font-weight: 600;
    color: #2468ff;
  }

  .login-brand h1 {
    max-width: 320px;
    margin: 0 0 10px;
    font-size: 27px;
    line-height: 1.35;
  }

  .login-brand > span {
    font-size: 14px;
    color: #78818e;
  }

  .login-card {
    padding: 22px 18px 18px;
  }

  .login-card label {
    display: block;
    margin-bottom: 10px;
    font-weight: 600;
  }

  .mobile-field {
    display: grid;
    grid-template-columns: 54px 1fr;
    align-items: center;
    height: 52px;
    margin-bottom: 14px;
    background: #f4f6f9;
    border: 1px solid transparent;
    border-radius: 11px;
  }

  .mobile-field:focus-within {
    border-color: #4f8bff;
    box-shadow: 0 0 0 3px rgb(79 139 255 / 12%);
  }

  .mobile-field span {
    text-align: center;
    border-right: 1px solid #dfe3e9;
  }

  .mobile-field input {
    min-width: 0;
    padding: 0 12px;
    background: transparent;
    border: 0;
    outline: 0;
  }

  .login-card .primary-button {
    width: 100%;
    margin-top: 8px;
  }

  .demo-button {
    width: 100%;
    min-height: 44px;
    margin-top: 8px;
    color: #647087;
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  .main-shell {
    min-height: 100dvh;
    background: #f2f6fc;
  }

  .tab-page {
    box-sizing: border-box;
    min-height: 100dvh;
    padding: max(26px, calc(env(safe-area-inset-top) + 18px)) 16px 104px;
  }

  .home-view {
    padding-top: max(30px, calc(env(safe-area-inset-top) + 22px));
  }

  .home-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    min-height: 94px;
    padding: 0 4px 18px;
  }

  .home-heading h1,
  .section-heading h1,
  .profile-heading h1 {
    margin: 0;
    font-size: 25px;
    font-weight: 700;
    color: #121722;
    letter-spacing: -0.02em;
  }

  .home-heading p,
  .section-heading p,
  .profile-heading p {
    margin: 7px 0 0;
    font-size: 14px;
    color: #68717f;
  }

  .doctor-mark {
    display: grid;
    place-items: center;
    width: 70px;
    height: 70px;
    margin-right: 10px;
    font-size: 46px;
    color: #2468ff;
    background: #fff;
    border: 1px solid #e6eefc;
    border-radius: 50%;
    box-shadow: 0 8px 24px rgb(46 93 164 / 10%);
  }

  .next-card,
  .health-card,
  .task-card,
  .summary-card,
  .plan-card,
  .profile-card,
  .empty-card {
    box-sizing: border-box;
    width: 100%;
    background: #fff;
    border: 0;
    border-radius: 14px;
    box-shadow: 0 8px 26px rgb(62 86 126 / 6%);
  }

  .next-card {
    padding: 16px;
  }

  .card-label {
    margin-bottom: 2px;
    font-size: 15px;
    font-weight: 600;
  }

  .next-time-row {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 12px;
  }

  .next-time-row strong {
    font-size: 34px;
    font-weight: 500;
    line-height: 1.2;
    color: #2a70ff;
  }

  .next-time-row span,
  .status-pill {
    padding: 4px 9px;
    font-size: 12px;
    color: #f39b1f;
    background: #fff3d8;
    border-radius: 99px;
  }

  .status-pill.completed {
    color: #148255;
    background: #e7f7ef;
  }

  .status-pill.missed {
    color: #d84b45;
    background: #fff0ef;
  }

  .status-pill.partial {
    color: #b76516;
    background: #fff2df;
  }

  .medication-preview {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) 24px;
    align-items: center;
    width: 100%;
    min-height: 58px;
    padding: 8px 10px;
    color: inherit;
    text-align: left;
    cursor: pointer;
    background: #edf5ff;
    border: 0;
    border-radius: 11px;
  }

  .preview-copy,
  .task-copy,
  .health-card > span:nth-child(2),
  .empty-inline > div,
  .drug-row > div {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .preview-copy strong,
  .task-copy strong,
  .health-card strong,
  .drug-row strong {
    overflow: hidden;
    font-size: 15px;
    font-style: normal;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview-copy small,
  .task-copy small,
  .health-card small,
  .empty-inline small,
  .drug-row small,
  .profile-card small {
    overflow: hidden;
    font-size: 12px;
    line-height: 1.35;
    color: #8a94a3;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chevron {
    font-size: 24px;
    color: #314258;
  }

  .wide-primary {
    width: 100%;
    min-height: 48px;
    margin-top: 14px;
    font-weight: 600;
    color: #fff;
    cursor: pointer;
    background: #2468ff;
    border: 0;
    border-radius: 24px;
  }

  .round-icon {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 38px;
    height: 38px;
    font-size: 21px;
    border-radius: 50%;
  }

  .round-icon.blue {
    color: #2468ff;
    background: #edf5ff;
  }

  .round-icon.orange {
    color: #ff792e;
    background: #fff0ea;
  }

  .round-icon.green {
    color: #0aaa70;
    background: #e8faf3;
  }

  .round-icon.purple {
    color: #aa3df0;
    background: #f8edff;
  }

  .health-card,
  .task-card {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    min-height: 80px;
    padding: 12px 14px;
    margin-top: 14px;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .health-card em,
  .task-card em,
  .status-link {
    min-width: 68px;
    padding: 8px 12px;
    font-size: 13px;
    font-style: normal;
    color: #ff7124;
    text-align: center;
    background: #fff0e9;
    border-radius: 18px;
  }

  .task-card em,
  .status-link {
    color: #fff;
    background: #2468ff;
  }

  .section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 18px 2px 0;
  }

  .section-title h2 {
    margin: 0;
    font-size: 18px;
  }

  .section-title span {
    font-size: 13px;
    color: #6f7886;
  }

  .task-stack.compact .task-card {
    margin-top: 12px;
  }

  .section-heading {
    padding: 12px 5px 24px;
  }

  .segment-control {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    height: 40px;
    margin-bottom: 14px;
    overflow: hidden;
    border: 1px solid #2468ff;
    border-radius: 7px;
  }

  .segment-control button {
    color: #2468ff;
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  .segment-control button.active {
    color: #fff;
    background: #2468ff;
  }

  .medication-view {
    padding-top: max(72px, calc(env(safe-area-inset-top) + 28px));
    background: #f4f7fd;
  }

  .medication-view .section-heading {
    padding: 0 6px 22px;
  }

  .medication-view .section-heading h1 {
    font-size: 28px;
    line-height: 1.2;
  }

  .medication-view .section-heading p {
    margin-top: 6px;
    font-size: 15px;
    color: #252a33;
  }

  .medication-view .segment-control {
    height: 36px;
    margin-bottom: 16px;
  }

  .medication-view .segment-control button {
    min-height: 36px;
    font-size: 16px;
  }

  .medication-summary-card {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) 55px minmax(0, 1fr);
    gap: 9px;
    align-items: center;
    min-height: 72px;
    padding: 10px 15px;
    border-radius: 14px;
    box-shadow: none;
  }

  .medication-clock {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    font-size: 23px;
    color: #2167ff;
    background: #ddecff;
    border-radius: 50%;
  }

  .next-medication-summary,
  .today-medication-summary {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .next-medication-summary small {
    font-size: 14px;
    color: #1f252f;
  }

  .next-medication-summary strong {
    font-size: 25px;
    font-weight: 500;
    line-height: 1.15;
    color: #2a70ff;
  }

  .today-medication-summary {
    gap: 5px;
    font-size: 14px;
  }

  .medication-progress-ring {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    width: 55px;
    padding-left: 14px;
    border-left: 1px solid #e7ebf2;
  }

  .medication-progress-ring :deep(.el-progress-circle__track) {
    stroke: #ddecff;
  }

  .today-medication-summary strong {
    font-size: 18px;
    font-weight: 500;
    color: #2167ff;
  }

  .medication-schedule {
    margin-top: 26px;
  }

  .medication-slot + .medication-slot {
    margin-top: 34px;
  }

  .medication-slot-heading {
    display: flex;
    gap: 10px;
    align-items: center;
    min-height: 34px;
    padding: 0 1px;
  }

  .medication-slot-heading h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
    line-height: 1.2;
    color: #11151b;
  }

  .medication-slot-heading h2 span {
    margin-right: 3px;
    font-weight: 650;
  }

  .timing-pill {
    padding: 4px 9px;
    font-size: 12px;
    color: #276efa;
    background: #eaf3ff;
    border-radius: 99px;
  }

  .medication-slot-heading .status-pill {
    margin-left: 0;
  }

  .medication-drug-list {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 13px 10px 0 41px;
  }

  .medication-drug-list::before {
    position: absolute;
    top: 36px;
    bottom: 28px;
    left: 15px;
    width: 1px;
    content: '';
    background: #d4dce8;
  }

  .medication-drug-card {
    position: relative;
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr) 58px;
    gap: 10px;
    align-items: center;
    min-height: 64px;
    padding: 11px 12px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 7px 18px rgb(61 81 117 / 9%);
  }

  .timeline-dot {
    position: absolute;
    top: 50%;
    left: -35px;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    color: #2167ff;
    background: #f4f7fd;
    transform: translateY(-50%);
  }

  .timeline-dot :deep(svg) {
    width: 100%;
    height: 100%;
  }

  .medication-drug-card img {
    width: 52px;
    height: 46px;
    object-fit: contain;
    border-radius: 8px;
  }

  .medication-drug-copy {
    min-width: 0;
  }

  .medication-drug-copy h3 {
    margin: 0 0 5px;
    overflow: hidden;
    font-size: 16px;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .medication-drug-copy p {
    margin: 0;
    overflow: hidden;
    font-size: 13px;
    color: #8b96a5;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .drug-checkin-button {
    min-width: 58px;
    min-height: 44px;
    padding: 0 10px;
    font-size: 16px;
    color: #fff;
    cursor: pointer;
    background: #2167ff;
    border: 0;
    border-radius: 7px;
  }

  .drug-checkin-button:disabled {
    color: #8b94a2;
    cursor: not-allowed;
    background: #e8ecf2;
  }

  .medication-empty {
    margin-top: 26px;
  }

  .medicine-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .medicine-list > article:not(.empty-card) {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr);
    gap: 12px;
    padding: 15px;
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 8px 26px rgb(62 86 126 / 6%);
  }

  .medicine-tile {
    display: grid;
    grid-row: span 2;
    place-items: center;
    width: 58px;
    height: 58px;
    font-size: 28px;
    color: #2468ff;
    background: #edf5ff;
    border-radius: 11px;
  }

  .medicine-list h2 {
    margin: 2px 0 6px;
    font-size: 17px;
  }

  .medicine-list p,
  .medicine-list small {
    margin: 0;
    font-size: 13px;
    color: #747d8b;
  }

  .medicine-list > article > strong {
    grid-column: 2;
    font-size: 13px;
    font-weight: 500;
    color: #2468ff;
  }

  .medicine-list > article > strong.warning {
    color: #d56b16;
  }

  .medicine-list .stock-warning {
    grid-column: 2;
    color: #b7601b;
    white-space: normal;
  }

  .medicine-guidance {
    grid-column: 1 / -1;
    padding-top: 4px;
    border-top: 1px solid #edf1f6;
  }

  .medicine-guidance summary {
    display: flex;
    align-items: center;
    min-height: 44px;
    font-size: 13px;
    font-weight: 600;
    color: #2468ff;
    cursor: pointer;
  }

  .medicine-guidance p {
    padding: 0 2px 10px;
    line-height: 1.7;
    color: #566274;
    white-space: pre-wrap;
  }

  .stock-method {
    padding: 0 4px;
    margin: 2px 0 0;
    font-size: 12px;
    line-height: 1.6;
    color: #7b8593;
  }

  .task-stack .task-card:first-child {
    margin-top: 0;
  }

  .task-card.static {
    min-height: 90px;
    cursor: default;
  }

  .task-copy .deadline {
    color: #5674a8;
  }

  .status-link {
    white-space: nowrap;
  }

  .task-detail-heading {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    padding: 4px 0 20px;
  }

  .task-detail-heading button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    font-size: 28px;
    color: #141922;
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  .task-detail-heading h1 {
    margin: 0;
    overflow: hidden;
    font-size: 21px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-detail-heading p {
    margin: 5px 0 0;
    font-size: 13px;
    color: #748091;
  }

  .task-form {
    padding: 18px 16px;
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 8px 26px rgb(62 86 126 / 6%);
  }

  .task-form fieldset {
    padding: 0;
    margin: 0 0 22px;
    border: 0;
  }

  .task-form legend,
  .task-form > label {
    display: block;
    width: 100%;
    margin-bottom: 11px;
    font-weight: 650;
    line-height: 1.55;
  }

  .choice-grid {
    display: grid;
    gap: 8px;
  }

  .choice-grid.two-columns {
    grid-template-columns: repeat(2, 1fr);
  }

  .choice-grid.symptom-grid {
    grid-template-columns: repeat(3, 1fr);
    margin-bottom: 14px;
  }

  .choice-grid button {
    min-height: 44px;
    padding: 6px 8px;
    color: #526071;
    cursor: pointer;
    background: #f5f7fa;
    border: 1px solid #e5e9ef;
    border-radius: 9px;
  }

  .choice-grid button.selected {
    color: #2468ff;
    background: #edf4ff;
    border-color: #4f86f6;
  }

  .task-form textarea,
  .task-form select,
  .task-form .extra-input {
    box-sizing: border-box;
    width: 100%;
    padding: 11px 12px;
    color: #202733;
    background: #f5f7fa;
    border: 1px solid #e5e9ef;
    border-radius: 9px;
    outline: 0;
  }

  .task-form textarea {
    min-height: 92px;
    resize: vertical;
  }

  .task-form select,
  .task-form .extra-input {
    min-height: 44px;
  }

  .task-form textarea:focus,
  .task-form select:focus,
  .task-form .extra-input:focus {
    background: #fff;
    border-color: #4f86f6;
  }

  .speech-input-row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin: 10px 0 18px;
  }

  .speech-input-row button {
    display: inline-flex;
    flex: 0 0 auto;
    gap: 6px;
    align-items: center;
    min-height: 44px;
    padding: 0 12px;
    color: #2468ff;
    cursor: pointer;
    background: #edf4ff;
    border: 1px solid #c9dcff;
    border-radius: 9px;
  }

  .speech-input-row button.listening {
    color: #fff;
    background: #e45650;
    border-color: #e45650;
  }

  .speech-input-row button:disabled {
    color: #9aa4b2;
    cursor: not-allowed;
    background: #f3f5f7;
    border-color: #e3e7ec;
  }

  .speech-input-row small {
    padding-top: 3px;
    font-size: 12px;
    line-height: 1.55;
    color: #7b8797;
  }

  .survey-option-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .survey-option-grid.three-columns {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .option-row {
    display: grid;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 5px 8px;
    color: #566273;
    text-align: center;
    cursor: pointer;
    background: #fff;
    border: 1px solid #e5e9ef;
    border-radius: 8px;
  }

  .option-row.selected {
    color: #fff;
    background: #4f86f6;
    border-color: #4f86f6;
  }

  .option-row:focus-within {
    outline: 2px solid rgb(79 134 246 / 24%);
    outline-offset: 2px;
  }

  .extra-input {
    margin-top: 8px;
  }

  .survey-form fieldset + fieldset {
    padding-top: 18px;
    border-top: 1px solid #edf0f4;
  }

  .form-intro {
    padding: 10px 12px;
    margin: 0 0 20px;
    font-size: 13px;
    line-height: 1.55;
    color: #5e6b7d;
    background: #f0f5ff;
    border-radius: 8px;
  }

  .task-detail-card {
    text-align: left;
  }

  .task-detail-card h2 {
    margin: 14px 0;
    font-size: 18px;
    line-height: 1.55;
  }

  .task-detail-card p {
    color: #687386;
  }

  .detail-tip {
    padding: 12px;
    line-height: 1.55;
    color: #805f22 !important;
    background: #fff5dc;
    border-radius: 8px;
  }

  .schedule-dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: 20;
    box-sizing: border-box;
    display: flex;
    align-items: flex-end;
    width: min(100%, 390px);
    padding: 16px 12px max(18px, env(safe-area-inset-bottom));
    margin: 0 auto;
    background: rgb(17 27 43 / 48%);
    backdrop-filter: blur(2px);
  }

  .schedule-dialog {
    box-sizing: border-box;
    width: 100%;
    max-height: min(78dvh, 620px);
    padding: 18px;
    overflow-y: auto;
    background: #fff;
    border-radius: 20px;
    box-shadow: 0 18px 48px rgb(17 27 43 / 28%);
  }

  .schedule-dialog > header {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    gap: 9px;
    align-items: center;
  }

  .schedule-dialog > header small {
    font-size: 12px;
    color: #7c8797;
  }

  .schedule-dialog h2 {
    margin: 3px 0 0;
    font-size: 19px;
  }

  .schedule-dialog > header > button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    color: #536071;
    cursor: pointer;
    background: #f3f5f8;
    border: 0;
    border-radius: 50%;
  }

  .schedule-description {
    margin: 18px 0 10px;
    line-height: 1.6;
    color: #414d5d;
  }

  .schedule-dialog dl {
    padding: 6px 14px;
    margin: 0 0 16px;
    background: #f5f8fc;
    border-radius: 12px;
  }

  .schedule-dialog dl > div {
    display: grid;
    grid-template-columns: 82px 1fr;
    padding: 10px 0;
  }

  .schedule-dialog dl > div + div {
    border-top: 1px solid #e7ebf1;
  }

  .schedule-dialog dt {
    color: #7b8797;
  }

  .schedule-dialog dd {
    margin: 0;
    font-weight: 600;
    color: #273346;
  }

  .schedule-dialog > label {
    display: block;
    margin-bottom: 8px;
    font-weight: 650;
  }

  .schedule-dialog textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 92px;
    padding: 11px 12px;
    resize: vertical;
    background: #f5f7fa;
    border: 1px solid #e5e9ef;
    border-radius: 9px;
    outline: 0;
  }

  .schedule-dialog textarea:focus {
    background: #fff;
    border-color: #4f86f6;
  }

  .adverse-view {
    padding-bottom: max(28px, env(safe-area-inset-bottom));
  }

  .adverse-form {
    display: flex;
    flex-direction: column;
  }

  .adverse-form > input {
    box-sizing: border-box;
    width: 100%;
    min-height: 48px;
    padding: 0 12px;
    margin-bottom: 22px;
    color: #202733;
    background: #f5f7fa;
    border: 1px solid #e5e9ef;
    border-radius: 9px;
    outline: 0;
  }

  .adverse-symptoms {
    margin-bottom: 0 !important;
  }

  .severity-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .severity-options button {
    min-height: 46px;
    color: #526071;
    cursor: pointer;
    background: #fff;
    border: 1px solid #e5e9ef;
    border-radius: 9px;
  }

  .severity-options .severity-1.selected {
    color: #2e9b58;
    background: #f1fbf4;
    border-color: #5bbc79;
  }

  .severity-options .severity-2.selected {
    color: #cd7a19;
    background: #fff9ed;
    border-color: #dfa24f;
  }

  .severity-options .severity-3.selected {
    color: #d94f4b;
    background: #fff1f0;
    border-color: #ee7772;
  }

  .severity-guidance {
    display: grid;
    grid-template-columns: 24px 1fr;
    gap: 10px;
    padding: 14px;
    color: #2f8c55;
    background: #f0faf4;
    border: 1px solid #bfe4cb;
    border-radius: 11px;
  }

  .severity-guidance.severity-2 {
    color: #b97019;
    background: #fff8ed;
    border-color: #f0d5ad;
  }

  .severity-guidance.severity-3 {
    color: #d84b47;
    background: #fff1f0;
    border-color: #efcac8;
  }

  .severity-guidance :deep(svg) {
    width: 22px;
    height: 22px;
    margin-top: 1px;
  }

  .severity-guidance p {
    margin: 5px 0 0;
    font-size: 13px;
    line-height: 1.55;
  }

  .adverse-submit.urgent {
    background: #e95b5b;
  }

  .adverse-success {
    padding: 42px 22px;
    text-align: center;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 8px 26px rgb(62 86 126 / 6%);
  }

  .adverse-success h2 {
    margin: 18px 0 8px;
  }

  .adverse-success p {
    margin: 0;
    line-height: 1.6;
    color: #657184;
  }

  .profile-heading {
    display: flex;
    gap: 16px;
    align-items: center;
    min-height: 138px;
    padding: 20px 16px;
  }

  .avatar {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 64px;
    height: 64px;
    font-size: 24px;
    color: #fff;
    background: #2f73f7;
    border: 2px solid #84aeff;
    border-radius: 50%;
  }

  .profile-card {
    padding: 0 16px;
  }

  .profile-card > div {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    min-height: 78px;
  }

  .profile-card > div + div {
    border-top: 1px solid #f0f2f6;
  }

  .profile-card > div > span:last-child {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .profile-card strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .profile-menu {
    overflow: hidden;
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 8px 26px rgb(62 86 126 / 6%);
  }

  .profile-menu button {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 24px;
    gap: 8px;
    align-items: center;
    width: 100%;
    min-height: 78px;
    padding: 10px 14px;
    color: inherit;
    text-align: left;
    cursor: pointer;
    background: #fff;
    border: 0;
  }

  .profile-menu button + button {
    border-top: 1px solid #f0f2f6;
  }

  .profile-menu button > span:nth-child(2) {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .profile-menu small {
    overflow: hidden;
    font-size: 12px;
    color: #8a94a3;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .report-filters {
    display: flex;
    gap: 10px;
    margin-bottom: 18px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .report-filters button {
    min-width: 68px;
    min-height: 38px;
    padding: 0 14px;
    color: #485465;
    white-space: nowrap;
    cursor: pointer;
    background: #fff;
    border: 0;
    border-radius: 20px;
  }

  .report-filters button.active {
    color: #fff;
    background: #2468ff;
  }

  .report-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .report-list > button {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    min-height: 92px;
    padding: 14px;
    color: inherit;
    text-align: left;
    cursor: pointer;
    background: #fff;
    border: 0;
    border-radius: 14px;
    box-shadow: 0 8px 26px rgb(62 86 126 / 6%);
  }

  .report-list > button > span:nth-child(2) {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .report-list strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .report-list small {
    font-size: 12px;
    color: #8a94a3;
  }

  .report-list em,
  .report-title-row span[class^='status-'] {
    padding: 5px 9px;
    font-size: 12px;
    font-style: normal;
    border-radius: 14px;
  }

  .status-pending {
    color: #d98918;
    background: #fff3d8;
  }

  .status-reviewed {
    color: #11834e;
    background: #e8f8ef;
  }

  .status-supplement {
    color: #e45650;
    background: #fff0ef;
  }

  .supplement-tip {
    grid-column: 1 / -1;
    padding-top: 9px;
    font-size: 12px;
    color: #e45650;
    border-top: 1px solid #fee1de;
  }

  .floating-action {
    position: sticky;
    bottom: 84px;
    display: flex;
    gap: 7px;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 50px;
    margin-top: 22px;
    font-weight: 600;
    color: #fff;
    cursor: pointer;
    background: #2468ff;
    border: 0;
    border-radius: 25px;
    box-shadow: 0 10px 25px rgb(36 104 255 / 22%);
  }

  .report-form > label:not(.upload-box) {
    margin-top: 16px;
  }

  .report-form > label:first-child {
    margin-top: 0;
  }

  .report-form > input:not(.visually-hidden) {
    box-sizing: border-box;
    width: 100%;
    min-height: 44px;
    padding: 10px 12px;
    background: #f5f7fa;
    border: 1px solid #e5e9ef;
    border-radius: 9px;
    outline: 0;
  }

  .upload-box {
    display: flex !important;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    justify-content: center;
    min-height: 112px;
    color: #2468ff;
    cursor: pointer;
    background: #f4f8ff;
    border: 1px dashed #9bbcfb;
    border-radius: 10px;
  }

  .upload-box :deep(svg) {
    width: 28px;
    height: 28px;
  }

  .upload-box small {
    font-size: 12px;
    color: #8290a5;
  }

  .upload-guidance {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px;
    margin-bottom: 10px;
    color: #4e5c70;
    background: #fff8e8;
    border-radius: 9px;
  }

  .upload-guidance :deep(svg) {
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    color: #d18318;
  }

  .upload-guidance span {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .upload-guidance small {
    font-size: 12px;
    line-height: 1.5;
    color: #7b6c52;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .report-upload-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
    margin-top: 10px;
  }

  .report-upload-grid > article {
    position: relative;
    min-width: 0;
    padding: 7px;
    background: #f7f9fc;
    border: 1px solid #e4e9f0;
    border-radius: 10px;
  }

  .report-preview {
    display: grid;
    place-items: center;
    height: 108px;
    overflow: hidden;
    background: #fff;
    border-radius: 7px;
  }

  .report-preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .report-pdf {
    font-size: 38px;
    color: #e24b47;
  }

  .report-upload-grid > article > span {
    display: block;
    padding: 7px 2px 1px;
    overflow: hidden;
    font-size: 12px;
    color: #536174;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .report-upload-grid > article > button {
    position: absolute;
    top: 12px;
    right: 12px;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    color: #d84b45;
    cursor: pointer;
    background: rgb(255 255 255 / 94%);
    border: 1px solid #f1d0ce;
    border-radius: 17px;
    box-shadow: 0 3px 10px rgb(44 56 78 / 12%);
  }

  .metric-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 20px 0 10px;
  }

  .metric-heading button {
    min-height: 38px;
    padding: 0 12px;
    color: #2468ff;
    cursor: pointer;
    background: #edf4ff;
    border: 0;
    border-radius: 8px;
  }

  .metric-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 40px;
    gap: 7px;
    margin-bottom: 8px;
  }

  .metric-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
  }

  .metric-fields input {
    min-width: 0;
    min-height: 42px;
    padding: 0 9px;
    background: #f5f7fa;
    border: 1px solid #e5e9ef;
    border-radius: 8px;
  }

  .metric-fields select {
    grid-column: 1 / -1;
    min-height: 42px;
  }

  .metric-row button {
    color: #d84b45;
    cursor: pointer;
    background: #fff0ef;
    border: 0;
    border-radius: 8px;
  }

  .metric-note {
    display: block;
    margin: 3px 0 12px;
    font-size: 12px;
    line-height: 1.55;
    color: #7b8797;
  }

  .report-detail-card,
  .report-files-card,
  .report-metrics-card,
  .supplement-card {
    padding: 16px;
    margin-bottom: 14px;
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 8px 26px rgb(62 86 126 / 6%);
  }

  .report-title-row {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    padding-bottom: 14px;
    border-bottom: 1px solid #eef1f5;
  }

  .report-title-row h2,
  .report-files-card h2,
  .report-metrics-card h2 {
    margin: 0 0 7px;
    font-size: 18px;
  }

  .report-detail-card dl {
    margin: 12px 0 0;
  }

  .report-detail-card dl > div {
    display: grid;
    grid-template-columns: 78px 1fr;
    padding: 7px 0;
  }

  .report-detail-card dt {
    color: #8190a3;
  }

  .report-detail-card dd {
    margin: 0;
  }

  .report-metrics-card dl {
    margin: 12px 0 0;
  }

  .report-metrics-card dl > div {
    display: grid;
    grid-template-columns: minmax(90px, 0.8fr) minmax(0, 1.2fr);
    gap: 10px;
    padding: 11px 0;
    border-top: 1px solid #eef1f5;
  }

  .report-metrics-card dt {
    font-weight: 600;
    color: #4f5d70;
  }

  .report-metrics-card dd {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    align-items: center;
    min-width: 0;
    margin: 0;
  }

  .report-metrics-card dd strong {
    color: #2468ff;
  }

  .report-metrics-card dd small {
    width: 100%;
    color: #7d8898;
  }

  .report-metrics-card dd em {
    padding: 3px 7px;
    font-size: 12px;
    font-style: normal;
    color: #bd4d28;
    background: #fff2e8;
    border-radius: 10px;
  }

  .supplement-card {
    color: #bd4d28;
    background: #fff2e8;
  }

  .supplement-card p,
  .report-files-card p {
    margin: 8px 0 0;
    line-height: 1.55;
    color: #6d7887;
  }

  .report-files-card ul {
    padding-left: 20px;
    margin-bottom: 0;
  }

  .report-files-card a {
    color: #2468ff;
  }

  .support-card {
    padding: 16px;
    margin-bottom: 14px;
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 8px 26px rgb(62 86 126 / 6%);
  }

  .support-card h2 {
    margin: 0;
    font-size: 17px;
  }

  .support-card > p {
    margin: 7px 0 0;
    font-size: 13px;
    line-height: 1.55;
    color: #748091;
  }

  .support-card dl {
    margin: 14px 0 0;
  }

  .support-card dl > div {
    display: grid;
    grid-template-columns: 84px 1fr;
    gap: 8px;
    padding: 10px 0;
    border-top: 1px solid #eef1f5;
  }

  .support-card dt {
    color: #7d8999;
  }

  .support-card dd {
    margin: 0;
    color: #2e3a4b;
  }

  .preference-card > label {
    display: grid;
    grid-template-columns: 1fr 44px;
    align-items: center;
    min-height: 66px;
    border-top: 1px solid #eef1f5;
  }

  .preference-card > label:first-of-type {
    margin-top: 12px;
  }

  .preference-card > label > span {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .preference-card small {
    color: #8792a0;
  }

  .preference-card input {
    width: 24px;
    height: 24px;
    margin: 0 auto;
    accent-color: #2468ff;
  }

  .support-note {
    margin: 0 4px;
    font-size: 12px;
    line-height: 1.6;
    color: #7d8796;
  }

  .contact-card {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
  }

  .contact-card a,
  .contact-card > small {
    grid-column: 2;
  }

  .contact-card a {
    font-size: 16px;
    font-weight: 600;
    color: #2468ff;
    text-decoration: none;
  }

  .article-card {
    padding: 0;
  }

  .article-card summary {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 24px;
    align-items: center;
    min-height: 76px;
    padding: 0 16px;
    list-style: none;
    cursor: pointer;
  }

  .article-card summary > span {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .article-card summary small {
    overflow: hidden;
    color: #8390a0;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .article-content {
    padding: 14px 16px 18px;
    margin: 0;
    line-height: 1.7;
    color: #4f5c6d;
    border-top: 1px solid #eef1f5;
  }

  .logout-button {
    width: 100%;
    min-height: 48px;
    margin-top: 18px;
    font-weight: 600;
    color: #d94d47;
    cursor: pointer;
    background: #fff;
    border: 1px solid #f0d7d5;
    border-radius: 12px;
  }

  .empty-card {
    padding: 36px 20px;
    margin-top: 14px;
    color: #7b8592;
    text-align: center;
  }

  .empty-inline {
    display: grid;
    grid-template-columns: 42px 1fr;
    gap: 8px;
    align-items: center;
  }

  .bottom-nav {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 8;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    width: min(100%, 390px);
    min-height: 74px;
    padding: 6px 6px max(8px, env(safe-area-inset-bottom));
    margin: 0 auto;
    background: rgb(255 255 255 / 97%);
    backdrop-filter: blur(12px);
    border-top: 1px solid #edf0f5;
  }

  .bottom-nav button {
    display: flex;
    flex-direction: column;
    gap: 3px;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 52px;
    color: #202630;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 28px;
  }

  .bottom-nav button :deep(svg) {
    width: 21px;
    height: 21px;
  }

  .bottom-nav button span {
    font-size: 11px;
  }

  .bottom-nav button.active {
    color: #2468ff;
    background: #eef3ff;
  }

  .shell-loading,
  .load-error {
    min-height: calc(100dvh - 80px);
  }

  .load-error .primary-button {
    min-width: 140px;
    margin-top: 16px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-icon {
      animation: none;
    }
  }
</style>
