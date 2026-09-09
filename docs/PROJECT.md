# 结核病患者管理：项目结构与业务说明

本文依据仓库中的 Vue 页面、API 模块、PHP 路由、控制器、服务和数据模型梳理。当前工作是为管理端接入独立的本地 Mock 服务；下文区分源码中已有能力与此次 Mock 运行约定。具体启动命令、演示账号、检查结果和未通过项以根目录 `README.md` 的最终验收记录为准，本文不作为运行验收通过的声明。

## 1. 项目构成与运行边界

| 部分 | 作用 | 当前本地演示中的处理 |
| --- | --- | --- |
| `frontend/` | 基于 Art Design Pro 的 Vue 3 管理端；TypeScript、Vite、Element Plus、Pinia、Vue Router | 保留页面和交互，通过本地 `/api` 访问 Mock |
| `backend/` | PHP 8.1+ / Webman 2.1 服务；包含管理员接口、患者小程序接口、数据库模型、定时任务和命令 | 保留源码供理解原契约，不启动、不连接其数据库或外部服务 |
| `backend/plugin/admin/public/` | 原后台托管的管理端构建产物；原 `/app/admin` 页面入口返回这里的 HTML | 不作为本地前端入口，不手工修改已编译资源 |
| `mock-api/` | 此次新增的 Node.js HTTP 服务，提供管理端所需契约和关联模拟数据 | 默认 `127.0.0.1:3010`，数据、会话、上传文件保存在进程内存 |
| 根目录运行入口 | 统一安装、启动和检查前端与 Mock | 前端默认 `3006`；启动、构建和预览均不得回退原服务 |

前端页面依次通过 `src/api/` 的业务 API、`src/utils/http/` 的 Axios 封装、同源 `/api` 代理访问本地 Mock。Mock 只返回虚构数据，不调用 PHP、不加载数据库数据、不转发未知接口。Mock 停止时，请求必须明确失败。

前端使用 ECharts 绘制工作台图表，wangEditor 编辑健康科普内容，上传组件及图库共同使用公共文件接口。Pinia 管理登录状态、菜单、字典、页面标签和界面设置；浏览器刷新后能否继续使用业务数据取决于同一个 Mock 进程是否仍在运行。

登录后，路由守卫获取用户信息和字典，并读取服务返回的动态菜单，由路由注册逻辑将菜单中的组件路径映射到已有 Vue 页面。仓库中存在更多模板页面，不代表这些页面已被当前业务菜单启用。

## 2. 当前八个业务入口

| 入口 | 页面地址 | 已有管理端能力与使用边界 |
| --- | --- | --- |
| 随访工作台 | `/dashboard/console` | 今日、近 7 天、近 30 天及统计日期切换；患者与建档指标、用药执行趋势、建档比例、不良反应严重程度、资源数和待办跳转 |
| 患者管理 | `/patient/index` | 分页浏览患者；详情位于隐藏路由 `/patient/detail?user_id=…`，展示基础档案及五个关联标签 |
| 用药计划 | `/medication-plan/index` | 今日与全部计划切换、患者姓名、日期、打卡状态筛选；接收患者 ID、逾期及逾期范围等路由参数 |
| 不良反应 | `/adverse-reaction/index` | 患者姓名、严重程度筛选，分页浏览、详情弹窗和筛选结果导出；详情直接使用列表记录，无独立详情请求 |
| 问卷管理 | `/survey/index` | 名称/编码关键词及状态筛选、嵌套题目与选项详情、答题数据导出 |
| 健康科普 | `/health-article/index` | 关键词及状态筛选，新增、编辑、详情、上架/下架，编辑富文本与图片 |
| 常用药品 | `/common-medicine/index` | 关键词及状态筛选、分页、药品详情展示和启停；详情使用已有记录，无单独管理端详情 API |
| 管理员 | `/admin/user` | 管理员列表、新增、编辑，账号联系方式和启停状态；编辑时可设置新密码 |

患者详情的五个标签是“今日用药计划”“全部用药计划”“患者药品”“问卷答题情况”“不良反应上报”。计划与不良反应复用全局列表接口并加入 `user_id`，因此详情与总表应能逐条核对。

个人中心属于公共功能：复用 `frontend/src/views/dashboard/user-center/index.vue`，由顶部用户入口进入隐藏路由；涵盖资料、头像、改密、登录日志和操作日志。顶部清缓存操作使用公共接口，其成功提示需等待服务响应。清缓存不等于重置模拟业务数据。

### 页面上没有的业务操作

- 患者列表与详情没有新增、编辑档案入口；建档写入属于原患者端。
- 管理端用药计划没有打卡、代打卡、修改方案或生成计划操作。
- 不良反应没有审核、处理流转或回访编辑接口。工作台“待审核”是现有展示名称，不代表完整审核流程。
- 问卷页面当前只提供详情、导出。API 模块有删除、启停函数，此次兼容接口但不增加对应按钮；原 PHP 的问卷保存能力不等于已有管理端编辑界面。
- 常用药品没有导入或新增编辑 UI。后台存在 `CommonMedicineImport` 等命令，不在本次 Mock 运行入口中执行。
- 没有增加患者小程序、OCR 识别、微信提醒、真实消息发送或医疗决策功能。

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

- 用药计划状态 `0` 为未打卡，`1` 为已打卡。完成数按计划条目计，不按患者人数计；一个患者一天可有多条计划。
- 工作台患者总数和建档数来自全部患者；时间范围主要作用于用药计划趋势和不良反应发生时间。不能因切换近 7 天而把患者总数解释成近 7 天新增患者。
- 今日模式的逾期数统计选定日期之前所有未打卡计划；近 7 天/30 天模式将起点限制在对应区间，终点仍不包含选定日期本身。
- 不良反应严重程度 `1/2/3` 分别为轻度/中度/重度，按 `occurred_at` 落入区间统计。原 `pending_review_total` 直接使用该区间的不良反应数量，并未额外筛选待审核状态。
- 原问卷列表的 `answerCount` 是答案表条数，即按题答案数；患者问卷状态的 `answer_count` 也是该患者在该模板下的答案条数，均不能当作去重作答人数。
- 问卷导出按患者分组：每名作答患者一行，每道题一列，提交时间取该患者该模板答案的最大提交时间。故导出数据行数通常不等于列表的 `answerCount`。
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

原 `backend/config/route.php` 并未声明上述 `/core/user/*`、日志、清缓存和图库路径；这些是前端继承的公共契约，需要由 Mock 补齐兼容。API 文件中其他未使用的模板函数，不自动进入本次覆盖范围。

### 当前业务接口

| 页面/行为 | 方法与路径 | 主要输入或返回特点 |
| --- | --- | --- |
| 工作台 | `GET /app/core/dashboard/overview` | `range=today\|7d\|30d`，可选 `date`；返回指标、趋势、建档比例、资源数、待办及严重程度分布 |
| 退出登录 | `POST /app/core/logout` | 本地 Mock 幂等注销当前会话 |
| 患者列表 | `GET /app/core/patient/index` | `current`、`size`；现有页面没有患者列表搜索表单 |
| 患者基本资料 | `GET /app/core/patient/detail` | `user_id` |
| 患者药品 | `GET /app/core/patient/medicine-list` | `user_id`、`current`、`size` |
| 患者问卷状态 | `GET /app/core/patient/survey-status` | `user_id`；返回模板状态数组 |
| 患者答卷 | `GET /app/core/patient/survey-answer-detail` | `user_id`、`template_id`；返回题目、答案摘要、选中选项和附加输入 |
| 全局/患者用药计划 | `GET /app/core/medication-plan/index` | 分页、`patient_name`、`user_id`、`plan_date`、`scope`、`status`、`overdue`、`overdue_range`、`as_of`（Mock历史逾期截止日） |
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

JSON 顶层统一为 `{code,message,data}`，成功码 `200`。多数业务分页返回 `{list,total,current,size}`；个人日志及图库沿用 `{data,total,current_page,per_page}`。导出成功返回真实二进制 XLSX，失败返回可识别的 JSON，不以空文件伪装成功。上传地址经本地同源代理访问，不使用原 OSS 地址。

## 5. 原 PHP 患者端与外部依赖

原服务同时包含另一套面向患者的 `/app/*` 接口，其登录态与管理端不同。源码声明了微信登录、手机号获取、建档与医院查询、处方识别、患者药品保存修改、提醒设置、用药计划打卡、不良反应上报、科普阅读及问卷提交等能力。`LoginMiddleware`、`LoginMobileMiddleware`、`ArchiveMiddleware` 分别控制相应登录、手机号和建档前置条件；管理端使用 `AdminAuthMiddleware`。

此外，`/app/admin/survey/template/*` 是复用患者登录态的问卷管理路由，与管理端 `/app/core/survey/*` 不同，不能因路径中都出现 `admin` 或 `survey` 就混用鉴权和契约。仓库中未发现独立患者小程序前端目录，本次交付也不新增它。

原服务依赖 MySQL 数据模型、Redis 缓存及队列，文件服务使用对象存储；AI 服务代码涉及阿里云百炼/DashScope 与 Dify，微信服务涉及登录、手机号、访问令牌和订阅消息。`MedicationReminderTask` 及 `MedicationReminderService` 负责原提醒任务，药品相关后台命令包含导入与资料同步。这些代码仅用于理解业务来源，不由 Mock 加载或执行；本地演示不需要原服务密钥，也不发送真实提醒。

## 6. 遗留模板与交付限制

前端还保留系统用户、角色、菜单、部门、岗位、配置、日志、安全维护、数据库、定时任务、代码生成以及图表示例等模板文件。当前业务菜单的来源是管理端动态菜单，不能简单将 `src/views/` 下每个目录都视作待接入业务。个人中心、上传与图库因被实际入口使用而纳入兼容；其他闲置模板不批量补接口。

本地 Mock 的目的是让现有管理端能独立演示和验证业务交互，不是 PHP 服务的完整替身。内存数据不提供持久化、多实例同步、生产身份认证、真实短信/微信/AI 能力或真实医学处理结果。模拟药品、用法和文章用于界面展示，不代表临床处方或经过审定的医疗内容。

验收应分别记录接口与关联数据检查、真实 XLSX 解析、上传图片预览、实际浏览器操作、原后台请求隔离、TypeScript 与构建结果。源码审阅、文件存在或单个接口成功，都不能替代这些运行证据。最终已验证项与限制请查根目录 `README.md`。

## 研究项目管理接口

功能与版本规则统一以 [功能架构](结核病临床研究患者管理系统_功能架构.md) 为准，本文仅记录实现入口。

| 页面/行为 | 接口 |
|---|---|
| 项目列表 | `GET /app/core/project/index` |
| 项目基本信息、分组索引及变更记录 | `GET /app/core/project/detail` |
| 项目新增/编辑 | `POST /app/core/project/save` |
| 人工变更项目状态 | `POST /app/core/project/change-status` |
| 通用内容选择目录 | `GET /app/core/project/catalog` |
| 分组详情 | `GET /app/core/project/group-detail` |
| 分组创建（仅基础信息） | `POST /app/core/project/group-create` |
| 患者候选及本项目归属 | `GET /app/core/project/participants` |
| 分组更新关联配置 | `POST /app/core/project/group-save` |

项目列表 `/project/index`，分组选择 `/project/groups?project_id=...`，新建在分组列表使用基础信息弹窗，详情 `/project/group?project_id=...&id=...`，编辑另追加 `mode=edit`。旧的无id路径转回列表新建入口。分组API校验项目归属，更新携带revision避免覆盖过期配置。服务代码在mock-api/projects.mjs，不调用PHP。

## 后续研究功能接口（2026-09-09）

以下均为本地 Mock，路径前缀 `/app/core/`；具体范围及未完成项以功能架构第十八节为准。

| 页面 | 接口（省略统一前缀） |
|---|---|
| 用药方案 | `medication-scheme/index`、`detail`、`save`、`status` |
| 任务模板 | `task-template/index`、`detail`、`save`、`status` |
| 问卷维护 | `survey/save`、`survey/detail`、`survey/toggle-status` |
| 患者研究管理 | `patient/management`、`save`、`confirmations`、`treatment`、`dispense`、`state` |
| 预计余药及盘点 | `patient/stock`、`stock-adjust` |
| 服药结果与联系 | `medication-plan/record`、`contact` |
| 个人随访任务 | `followup/index`、`detail`、`create`、`update` |
| 检查报告 | `report/index`、`detail`、`create`、`supplement`、`review` |
| 不良反应评估 | `adverse-reaction/assessment`、`assess`、`contact` |
| 每日反馈记录 | `feedback/index`、`record`；保存症状及文字，不保存原始音频 |
| 研究汇总 | `dashboard/research` |
| 新增记录导出 | `research/export?kind=patients|tasks|reports|feedback` |

列表、详情、汇总和导出使用GET，其余写入使用POST。数据、上传与会话均在内存中，服务重启后重置。每日反馈的客户端语音转写不在本仓库实现。
