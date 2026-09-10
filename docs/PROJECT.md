# 结核病患者管理：项目结构与业务说明

本文依据仓库中的 Vue 页面、API 模块、PHP 路由、控制器、服务和数据模型梳理。当前工作是为管理端接入独立的本地 Mock 服务；下文区分源码中已有能力与此次 Mock 运行约定。具体启动命令、演示账号、检查结果和未通过项以根目录 `README.md` 的最终验收记录为准，本文不作为运行验收通过的声明。

## 1. 项目构成与运行边界

| 部分 | 作用 | 当前本地演示中的处理 |
| --- | --- | --- |
| `frontend/` | 基于 Art Design Pro 的 Vue 3 前端；含医生管理端及患者移动入口，使用 TypeScript、Vite、Element Plus、Pinia、Vue Router | 保留页面和交互，通过本地 `/api` 访问 Mock |
| `backend/` | PHP 8.1+ / Webman 2.1 服务；包含管理员接口、患者小程序接口、数据库模型、定时任务和命令 | 保留源码供理解原契约，不启动、不连接其数据库或外部服务 |
| `backend/plugin/admin/public/` | 原后台托管的管理端构建产物；原 `/app/admin` 页面入口返回这里的 HTML | 不作为本地前端入口，不手工修改已编译资源 |
| `mock-api/` | 此次新增的 Node.js HTTP 服务，提供管理端所需契约和关联模拟数据 | 默认 `127.0.0.1:3010`，数据、会话、上传文件保存在进程内存 |
| 根目录运行入口 | 统一安装、启动和检查前端与 Mock | 前端默认 `3006`；启动、构建和预览均不得回退原服务 |

前端页面依次通过 `src/api/` 的业务 API、`src/utils/http/` 的 Axios 封装、同源 `/api` 代理访问本地 Mock。Mock 只返回虚构数据，不调用 PHP、不加载数据库数据、不转发未知接口。Mock 停止时，请求必须明确失败。

前端使用 ECharts 绘制工作台图表，wangEditor 编辑健康科普内容，上传组件及图库共同使用公共文件接口。Pinia 管理登录状态、菜单、字典、页面标签和界面设置；浏览器刷新后能否继续使用业务数据取决于同一个 Mock 进程是否仍在运行。

医生登录后，路由守卫获取用户信息和字典，并读取服务返回的动态菜单，由路由注册逻辑将菜单中的组件路径映射到已有 Vue 页面。患者移动入口 `/patient-app` 是不依赖医生登录的静态路由，使用独立患者令牌。仓库中存在更多模板页面，不代表这些页面已被当前业务菜单启用。

## 2. 当前业务入口

| 入口 | 页面地址 | 已有管理端能力与使用边界 |
| --- | --- | --- |
| 随访工作台 | `/dashboard/console` | 今日、近 7 天、近 30 天及统计日期切换；研究/分组范围；患者、用药、报告、事件和任务指标及同范围下钻 |
| 研究管理 | `/project/index` | 建立研究和多个分组；分组关联通用用药方案、问卷、任务模板及提醒方案，并查看已入组患者 |
| 患者管理 | `/patient/index` | 姓名/手机号/编号、研究状态、研究/分组和入组日期筛选；三步建档、个体用药、发药、状态与关联记录 |
| 用药管理 | `/medication-plan/schemes`、`/medication-plan/index` | 通用用药方案维护；执行计划支持已服、明确未服、未记录及取消/暂停状态，并可人工记录联系 |
| 随访任务 | `/followup/index`、`/followup/feedback`、`/followup/templates`、`/followup/reminder-schemes` | 任务列表、临时任务、改期/取消/联系；每日反馈、任务模板和提醒方案分开维护 |
| 检查报告 | `/reports/index` | 患者或报告类型、状态、研究/分组和日期筛选；代录、原资料、补传、人工指标与核对流程 |
| 不良反应 | `/adverse-reaction/index` | 患者姓名、严重程度筛选，详情、人工评估/跟进和筛选结果导出 |
| 问卷管理 | `/survey/index` | 基础新增、编辑、启停、详情和答卷导出；列表分开展示答卷份数与参与患者数 |
| 健康科普 | `/health-article/index` | 关键词及状态筛选，新增、编辑、详情、上架/下架，编辑富文本与图片 |
| 常用药品 | `/common-medicine/index` | 关键词及状态筛选、分页、药品详情展示和启停；详情使用已有记录，无单独管理端详情 API |
| 管理员 | `/admin/user` | 管理员列表、新增、编辑，账号联系方式和启停状态；编辑时可设置新密码 |

患者详情的七个标签是“今日用药计划”“全部用药计划”“患者药品”“问卷答题情况”“不良反应上报”“每日反馈”“检查报告”。用药、不良反应、反馈和报告复用全局明细接口并加入 `user_id`，因此患者页与总表可逐条核对。

个人中心属于公共功能：复用 `frontend/src/views/dashboard/user-center/index.vue`，由顶部用户入口进入隐藏路由；涵盖资料、头像、改密、登录日志和操作日志。顶部清缓存操作使用公共接口，其成功提示需等待服务响应。清缓存不等于重置模拟业务数据。

### 当前本地实现边界

- 患者列表和研究分组均可进入患者连续建档；已建档资料、个体方案、发药和研究状态在“患者研究管理”维护。
- 管理端用药计划可人工记录已服、未服或联系；方案变更通过患者个体用药完成，不在执行表中直接改药。
- 不良反应已有人工评估、处理状态和联系记录；真实通知发送、时限升级和研究方案责任规则尚未联调。
- 问卷页面提供新增、编辑、详情、启停与导出；已有答卷保留题目和选项快照，复杂分支编排器不在第一版。
- 常用药品作为用药方案的基础选药目录，当前只支持查询、详情和启停，不提供药房库存、采购或结算。
- 患者端已增加双确认、四菜单、用药、任务、问卷、每日反馈、报告、不良反应、提醒偏好和服务信息；每日反馈含体重下降及移动 Web 语音转文字降级，报告核对保留单位、参考范围和可选异常标识，药品可展开用药指导。尚未接入真实微信容器、真实 OCR、订阅消息或医疗决策功能。

## 3. 数据对象、关联与统计口径

### 核心数据关系

| 数据对象 | 原模型/表 | 关键关系 |
| --- | --- | --- |
| 患者档案 | `UserModel` / `tb_user` | 患者 ID 是计划、药品、答卷、不良反应的共同 `user_id`；含建档状态、建档日期、就诊机构等信息 |
| 患者药品 | `UserMedicineModel` / `tb_user_medicine` | 归属一个患者，保存名称、规格、用法用量、批次、来源等；来源有手工和 OCR |
| 用药计划 | `UserMedicationPlanModel` / `tb_user_medication_plan` | 通过 `user_id` 关联患者、`medicine_id` 关联患者药品；按日期、提醒时刻及当天序号记录一次计划，带药品信息快照 |
| 不良反应报告 | `UserAdverseReactionReportModel` / `tb_user_adverse_reaction_report` | 归属患者，含发生时间、症状、程度、提示文字和上报时间 |
| 问卷模板 | `SurveyTemplateModel` / `tb_survey_template` | 一个模板有多道题，`fillable_day` 表示建档后经过多少天可填 |
| 问卷题目、选项 | `SurveyQuestionModel`、`SurveyOptionModel` | 题目归属模板，选项归属题目；支持单选、多选、文本、互斥选项和选择后附加输入 |
| 问卷答案 | `SurveyAnswerModel` / `tb_survey_answer` | 每条是一个患者对一道题的答案，包含 `template_id`、`user_id`、`question_id`、选项 ID、文本、附加输入和提交时间 |
| 常用药、科普、管理员 | `CommonMedicineModel`、`HealthArticleModel`、`AdminModel` | 常用药是公共资源，不能将其 ID 直接当作患者药品 ID；科普与管理员各自独立管理 |

问卷模板结构参考 `backend/public/sql/survey_followup_seed.sql`，只读取题型和结构，不执行 SQL。患者详情的问卷状态根据建档日期与模板开放天数计算，答案详情把原始选项 ID 和条件输入解析成可读内容。

### 需要保持的口径

- 用药计划状态 `0/1/2/3` 分别为未记录、已服、明确未服、已取消或暂停。完成数按药品计划条目计，患者端则以同一日期和时点为一次操作。
- 工作台患者总数和建档数来自全部患者；时间范围主要作用于用药计划趋势和不良反应发生时间。不能因切换近 7 天而把患者总数解释成近 7 天新增患者。
- 今日模式的逾期数统计选定日期之前所有未打卡计划；近 7 天/30 天模式将起点限制在对应区间，终点仍不包含选定日期本身。
- 不良反应严重程度 `1/2/3` 分别为轻度/中度/重度，按 `occurred_at` 落入区间统计。原 `pending_review_total` 直接使用该区间的不良反应数量，并未额外筛选待审核状态。
- 问卷列表的 `answerCount`、`participantCount`、`answerRowCount` 分别是答卷提交份数、去重患者数和单题答案行数，三者不混用。
- 问卷导出每份答卷一行、每道题一列，保留实际轮次和提交时间；同一患者多轮作答会形成多行。
- 有答案的问卷不得删除。患者详情、问卷列表与导出使用同一份答案数据，选项名称、答案摘要和条件输入应保持一致。

Mock 初始日期以 `Asia/Shanghai` 当天为基准，提供今日、近期、较早的未打卡记录及不同严重程度、建档状态、启停状态。另设没有关联数据的虚构患者以检查空状态。统计从共享明细计算；服务内的新增、修改、启停、删除和上传会影响后续查询，刷新浏览器保留，重启 Mock 统一恢复初始业务数据并清空会话和上传资源。

## 4. 页面—接口覆盖表

以下路径均为前端 API 代码中的路径；浏览器经 `/api` 前缀访问。除公开登录和验证码外，业务请求携带 `Authorization: Bearer …`。

### 登录、菜单和公共能力

| 使用位置 | 方法与路径 | 用途 |
| --- | --- | --- |
| 登录页 | `GET /app/core/captcha`、`POST /app/core/login` | 验证码与账号登录；错误验证码、账号密码、停用账号应失败 |
| 登录初始化 | `GET /app/core/system/user` | 账号资料、角色、按钮权限及默认工作台 |
| 路由和字典初始化 | `GET /app/core/system/menu`、`GET /app/core/system/dictAll` | 当前业务菜单、隐藏路由及字典 |
| 个人资料 | `POST /core/user/updateInfo` | 资料和头像地址保存 |
| 个人改密 | `POST /core/user/modifyPassword` | 校验旧密码并修改密码 |
| 个人日志 | `GET /core/system/getLoginLogList`、`GET /core/system/getOperationLogList` | 当前账号登录及操作日志分页 |
| 顶部清缓存 | `GET /core/system/clearAllCache` | 返回操作结果，不重置内存业务数据 |
| 富文本、头像和文件上传 | `POST /app/core/file/upload-file` | 接收 `FormData.file`，返回本地可访问的资源地址 |
| 图库 | `GET /core/system/getResourceCategory`、`GET /core/system/getResourceList` | 图片分类和分页资源列表，包含上传后的图片 |
| 患者登录 | `POST /app/login`、`POST /app/logout` | 后台登记手机号准入；患者会话与医生会话隔离 |
| 患者首次确认 | `GET /app/patient/bootstrap`、`POST /app/patient/confirm-identity`、`POST /app/patient/confirm-medication` | 按身份、当前治疗方案顺序确认，保存错误或疑问说明 |
| 患者用药 | `GET /app/patient/medication`、`POST /app/patient/medication-slot` | 按日期+时点整次记录，支持部分未服、明确未服和有原因的更正；返回近期时点与余药估算 |
| 患者任务与提交 | `GET /app/patient/tasks`、`POST /app/patient/feedback`、`POST /app/patient/survey-submit`、`POST /app/patient/adverse-report` | 任务快照、每日反馈、多轮问卷和不良反应上报；反馈只接收转写后的文字，不接收原始音频 |
| 患者报告 | `GET /app/patient/reports`、`GET /app/patient/report-detail`、`POST /app/patient/report-submit`、`POST /app/patient/report-confirm` | 报告上传/补传、患者核对名称/值/单位/参考范围/异常标识及原资料历史 |
| 患者服务 | `GET /app/patient/support`、`POST /app/patient/reminder-preferences` | 小组提醒方案、个人消息偏好、联系人及已发布科普 |

原 `backend/config/route.php` 并未声明上述 `/core/user/*`、日志、清缓存和图库路径；这些是前端继承的公共契约，需要由 Mock 补齐兼容。API 文件中其他未使用的模板函数，不自动进入本次覆盖范围。

### 当前业务接口

| 页面/行为 | 方法与路径 | 主要输入或返回特点 |
| --- | --- | --- |
| 工作台 | `GET /app/core/dashboard/overview` | `range=today\|7d\|30d`，可选 `date`、`project_id`、`group_id`；返回同范围指标、趋势、资源数和待办 |
| 退出登录 | `POST /app/core/logout` | 本地 Mock 幂等注销当前会话 |
| 患者列表 | `GET /app/core/patient/index` | 分页；姓名/手机号/编号、研究状态、研究/分组和入组日期筛选 |
| 患者基本资料 | `GET /app/core/patient/detail` | `user_id` |
| 患者药品 | `GET /app/core/patient/medicine-list` | `user_id`、`current`、`size` |
| 患者问卷状态 | `GET /app/core/patient/survey-status` | `user_id`；返回模板状态数组 |
| 患者答卷 | `GET /app/core/patient/survey-answer-detail` | `user_id`、`template_id`；返回题目、答案摘要、选中选项和附加输入 |
| 全局/患者用药计划 | `GET /app/core/medication-plan/index` | 分页、患者、日期、状态、逾期、研究/分组与日期范围；`as_of` 用于历史待办下钻 |
| 全局/患者不良反应 | `GET /app/core/adverse-reaction/index` | 分页、`patient_name`、`user_id`、`severity` |
| 不良反应导出 | `GET /app/core/adverse-reaction/export` | 应用全部筛选条件、不受当前页限制；成功返回 XLSX |
| 问卷列表 | `GET /app/core/survey/index` | 分页、`keyword`、`status`；问卷字段保持 camelCase |
| 问卷详情 | `GET /app/core/survey/detail` | `id`；嵌套 `questions`、`options` 和 `inputFields` |
| 问卷导出 | `GET /app/core/survey/export` | `id`；按患者和题目展开为 XLSX |
| 问卷兼容操作 | `POST /app/core/survey/delete`、`POST /app/core/survey/toggle-status` | `id`，启停另带 `status`；保留删除 API；新增与编辑见下方研究功能接口，启停已提供页面按钮 |
| 科普列表、详情 | `GET /app/core/health-article/index`、`GET /app/core/health-article/detail` | 列表分页及关键词/状态筛选；详情传 `id` |
| 科普保存、启停 | `POST /app/core/health-article/save`、`POST /app/core/health-article/toggle-status` | 保存含标题、摘要、富文本、排序、状态及可选 ID；启停传 `id`、`status` |
| 常用药品列表、启停 | `GET /app/core/common-medicine/index`、`POST /app/core/common-medicine/toggle-status` | 列表分页、`keyword`、`status`；启停传 `id`、`status` |
| 管理员列表 | `GET /app/core/admin/index` | 返回数组，不改造成业务分页对象 |
| 管理员新增、编辑 | `POST /app/core/admin/save`、`POST /app/core/admin/update` | 账号、密码、联系方式、状态等；更新传 `id`，未填写新密码时保留原密码 |
| 研究数据导出 | `GET /app/core/research-export` | `kind=patients\|tasks\|reports\|feedback\|medications`；应用研究/分组/日期和页面筛选，导出全部结果 |

JSON 顶层统一为 `{code,message,data}`，成功码 `200`。多数业务分页返回 `{list,total,current,size}`；个人日志及图库沿用 `{data,total,current_page,per_page}`。导出成功返回真实二进制 XLSX，失败返回可识别的 JSON，不以空文件伪装成功。上传地址经本地同源代理访问，不使用原 OSS 地址。

## 5. 原 PHP 患者端与外部依赖

原服务同时包含另一套面向患者的 `/app/*` 接口，其登录态与管理端不同。源码声明了微信登录、手机号获取、建档与医院查询、处方识别、患者药品保存修改、提醒设置、用药计划打卡、不良反应上报、科普阅读及问卷提交等能力。`LoginMiddleware`、`LoginMobileMiddleware`、`ArchiveMiddleware` 分别控制相应登录、手机号和建档前置条件；管理端使用 `AdminAuthMiddleware`。当前本地 Mock 仅选择性实现会议要求对应的患者端接口。

此外，`/app/admin/survey/template/*` 是复用患者登录态的问卷管理路由，与管理端 `/app/core/survey/*` 不同，不能因路径中都出现 `admin` 或 `survey` 就混用鉴权和契约。仓库原先没有独立患者小程序前端目录；第一版在现有 Vue 工程新增 `/patient-app` 全屏移动入口，以便复用构建和本地 Mock，正式微信小程序工程仍需发布阶段迁移或适配。

原服务依赖 MySQL 数据模型、Redis 缓存及队列，文件服务使用对象存储；AI 服务代码涉及阿里云百炼/DashScope 与 Dify，微信服务涉及登录、手机号、访问令牌和订阅消息。`MedicationReminderTask` 及 `MedicationReminderService` 负责原提醒任务，药品相关后台命令包含导入与资料同步。这些代码仅用于理解业务来源，不由 Mock 加载或执行；本地演示不需要原服务密钥，也不发送真实提醒。

## 6. 遗留模板与交付限制

前端还保留系统用户、角色、菜单、部门、岗位、配置、日志、安全维护、数据库、定时任务、代码生成以及图表示例等模板文件。当前业务菜单的来源是管理端动态菜单，不能简单将 `src/views/` 下每个目录都视作待接入业务。个人中心、上传与图库因被实际入口使用而纳入兼容；其他闲置模板不批量补接口。

本地 Mock 的目的是让现有管理端能独立演示和验证业务交互，不是 PHP 服务的完整替身。内存数据不提供持久化、多实例同步、生产身份认证、真实短信/微信/AI 能力或真实医学处理结果。模拟药品、用法和文章用于界面展示，不代表临床处方或经过审定的医疗内容。

验收应分别记录接口与关联数据检查、真实 XLSX 解析、上传图片预览、实际浏览器操作、原后台请求隔离、TypeScript 与构建结果。源码审阅、文件存在或单个接口成功，都不能替代这些运行证据。最终已验证项与限制请查根目录 `README.md`。

## 研究管理接口

功能与版本规则统一以 [功能架构](结核病临床研究患者管理系统_功能架构.md) 为准，本文仅记录实现入口。

| 页面/行为 | 接口 |
|---|---|
| 项目列表 | `GET /app/core/project/index`；返回分组数及去重患者数 |
| 项目编辑数据及分组索引 | `GET /app/core/project/detail`；不提供单独的项目详情页面入口 |
| 项目新增/编辑 | `POST /app/core/project/save`；当前仅维护编号、名称、研究周期和研究目的 |
| 人工变更项目状态 | `POST /app/core/project/change-status` |
| 通用内容选择目录 | `GET /app/core/project/catalog` |
| 分组详情及当前已入组患者 | `GET /app/core/project/group-detail` |
| 分组创建（仅基础信息） | `POST /app/core/project/group-create` |
| 分组基础信息编辑 | `POST /app/core/project/group-basic-save`；只更新名称和说明 |
| 分组更新关联配置 | `POST /app/core/project/group-save` |

项目列表 `/project/index` 的操作为分组、编辑及状态，不再提供项目详情入口。分组选择 `/project/groups?project_id=...`，新建使用基础信息弹窗并在成功后停留于列表；列表“编辑”仍在当前页弹窗中修改名称和说明，“进入分组”使用 `/project/group?project_id=...&id=...`。分组详情固定为患者、用药方案、随访问卷、任务模板和提醒方案五个页签，顶部显示配置摘要；患者页可带入当前研究和分组新增患者。详情页的“配置方案与任务”进入 `mode=edit`，调整用药、随访和提醒配置。旧的无id路径转回列表新建入口。分组API校验项目归属，更新携带revision避免覆盖过期数据。服务代码在mock-api/projects.mjs，不调用PHP。

## 后续研究功能接口（2026-09-09）

以下均为本地 Mock，路径前缀 `/app/core/`；具体范围及未完成项以功能架构第十八节为准。

| 页面 | 接口（省略统一前缀） |
|---|---|
| 用药方案 | `medication-scheme/index`、`detail`、`save`、`status` |
| 任务模板 | `task-template/index`、`detail`、`save`、`status` |
| 问卷维护 | `survey/save`、`survey/detail`、`survey/toggle-status` |
| 患者研究管理 | `patient/management`、`onboard`、`save`、`confirmations`、`treatment`、`dispense`、`state` |
| 预计余药及盘点 | `patient/stock`、`stock-adjust` |
| 服药结果与联系 | `medication-plan/record`、`contact` |
| 个人随访任务 | `followup/index`、`detail`、`create`、`update` |
| 检查报告 | `report/index`、`detail`、`create`、`supplement`、`review` |
| 不良反应评估 | `adverse-reaction/assessment`、`assess`、`contact` |
| 每日反馈记录 | `feedback/index`、`record`；保存症状及文字，不保存原始音频 |
| 研究汇总 | `dashboard/research` |
| 新增记录导出 | `research/export?kind=patients|tasks|reports|feedback` |

列表、详情、汇总和导出使用GET，其余写入使用POST。数据、上传与会话均在内存中，服务重启后重置。移动 Web 患者端使用浏览器语音识别转写每日反馈文字；真实微信小程序的权限、转写服务和真机降级仍需单独适配验收。
