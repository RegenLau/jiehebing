# 本地 Mock API

仅用于前端开发演示，不启动或连接仓库中的 PHP 后台、MySQL、Redis、OSS、微信或 AI 服务。Node 22 及以上；所有业务数据、账号修改、会话与上传文件均在内存，重启服务后重置。

```sh
pnpm --dir mock-api install --frozen-lockfile
pnpm --dir mock-api start
pnpm --dir mock-api test
```

服务只监听 `127.0.0.1:3010`。前端通过 Vite `/api` 代理访问，代理需去掉 `/api` 前缀。健康检查 `GET /health`。演示账号 `admin` / `Mock123456`，验证码固定为 `1234`，每次登录仍须先取新的验证码 `uuid`（5 分钟有效）；登录会话 8 小时有效，停用账号、修改密码会使其已有会话失效。退出接口 `POST /app/core/logout` 幂等，只销毁当前会话。

本服务仅支撑管理后台。患者端将由真实微信小程序和正式服务端另行实现，因此本地 Mock 不提供 `/app/login`、`/app/logout` 或 `/app/patient/*`；请求这些路径会返回 HTTP 404。患者身份绑定、授权、提交和消息触达不在本服务内模拟成功。

提供当前管理端使用的 `/app/core` 接口、登录别名 `/app/admin/captcha` 与 `/app/admin/login`，另补研究分组、提醒方案、个人中心资料、密码、登录/操作日志、图库和清缓存兼容接口。未知路径返回 HTTP 404，绝不转发。JSON 包装沿用 `{code,message,data}`，业务错误使用包装内错误码；列表分页使用 `current/size` 和 `{list,total,current,size}`。个人中心/图库的旧分页使用 `page/limit` 和 `{data,total,current_page,per_page,last_page}`。

上传 `POST /app/core/file/upload-file` 使用 multipart 字段 `file`，支持 JPG、PNG、GIF、PDF，最大 10 MB。返回 `/api/mock-files/:id` 同源 URL，原始字节在内存保存；图片出现在图库，文件可直接预览。问卷、不良反应、患者、随访任务、检查报告、每日反馈和用药计划导出为真实 `.xlsx`，应用当前全部筛选条件，不受列表分页限制。

种子包含 30 名明确标识的后台建档模拟患者，均有出生日期、独立的 11 位模拟手机号和有效研究分组；6 个研究分组覆盖 3 个模拟项目，每个项目各 2 个分组，另有 1 个已结束项目演示组，所有患者不会重复归组。每名患者均按所属分组的用药方案和提醒方案生成患者药品、用药计划及随访任务。另有 3 套提醒方案、当天/历史/未来计划、36 条不良反应、16 条常用药、13 篇文章、2 份问卷。保留部分近期建档患者用于未到执行日期状态，同时长期患者覆盖超过 30 天的未登记计划；不会生成建档之前的计划。问卷 1 有 8 份模拟答卷，每份 6 题，问卷 2 为未作答草稿。问卷列表 `answerCount` 是答卷份数（初始 8），`participantCount` 是去重患者数（初始 8），`answerRowCount` 是单题答案行数（初始 48）；导出按每份答卷一行。

`reminder-scheme/index`、`detail`、`save` 和 `status` 仅保留给历史 Mock 数据与旧接口兼容，医生菜单不再开放提醒方案维护。研究分组中的每项随访问卷和任务直接保存 `remind_time`；页面不再设置开始/到期/逾期阶段。旧分组缺少逐项时间时，读取接口使用原分组快照中的任务提醒时间作为默认值。

取药提醒不再作为固定周期任务，也不进入任务模板目录。每个分组分别设置提前天数、提醒时间和要求说明；服务按患者最近一次实际发药或余药盘点，扣除截至昨日的计划消耗，再以当前个体方案的“单次用量 × 每日次数”计算每种药的预计可用天数，多药方案取最早不足项。患者缺少实际发药或盘点时不生成提醒；登记新的实际发药后自动重算。后台仅展示计算结果和待办，真实微信小程序中的提醒展示、联系医院、消息发送、回执和失败兜底属于后续正式联调范围。

患者新增主流程使用 `POST /app/core/patient/onboard`，一次提交患者资料、研究分组、个人用药方案和首次发药；首次发药为必填，任一步校验失败都会整体回滚。个人方案默认复制分组方案，`adjusted=true` 时仅允许调整组内药品的疗程、启停、单次用量和服药时间，并记录差异、原因、生效日期和来源版本。`patient/save`、`patient/treatment`、`patient/dispense` 继续供已建档患者的分步维护使用。

所有日期以启动时上海日期生成；工作台指标、趋势及待办均从同一份明细计算。患者建档后创建药品与计划，用药天数以药品创建日期为第 1 天；上报不早于建档，答卷不早于问卷创建与允许填写日期。患者姓名、手机号、医院和资源均为虚构。代码中的示例用药内容仅为界面演示。

`GET /app/core/medication-plan/index` 额外支持可选 `as_of=YYYY-MM-DD`：在 `overdue=true` 时，逾期截止日和 `overdue_range` 起点以该日计算，保证历史工作台待办下钻与统计一致。缺省或非法日期仍使用上海当天；该参数不改变常规列表的 `scope=today` 行为，待办下钻应传 `scope=all,status=0,overdue=true`。

`GET /app/core/patient/index`、`followup/index`、`feedback/index`、`reports/index`、`medication-plan/index` 和 `dashboard/overview` 支持 `project_id`/`group_id`；明细列表支持对应日期范围。`followup/index` 汇总后台已建档且项目未结束患者的待办，包含动态每日反馈、取药提醒、分组生成任务及有效临时任务，不再依赖患者端登录资格。`GET /app/core/research-export` 支持 `patients|tasks|reports|feedback|medications`，任务导出与列表共用数据口径，并含提醒时间和来源。

用药方案管理提供“上传处方图片 / 关键词搜索”两个添加入口；分组用药只提供关键词搜索，可选择带入通用方案后调整。两处均按药品卡片保存：保留治疗天数，每张卡配置首次发药量、每次剂量、每日 1–4 次及对应时间/服药时机，全部确认后才能保存。取药周期由服务端计算为各药品 `药品量 / 每次剂量 / 每日次数` 的最小值向下取整，至少 1 天且不超过治疗天数；不再手填取药周期。分组快照独立于通用方案，修改分组不会改写已确认的患者个人方案。`POST /app/core/medication-scheme/recognize-prescription` 只接受已上传的本地图片，返回明确标记的模拟待确认药品，不执行真实 OCR；旧 `project/recognize-prescription` 路径保留兼容。

药品库规格按沈阳红旗制药官方产品说明核对（2026-09-10），不以占位文案替代：[异烟肼片 0.1g×100片/瓶](https://www.hongqipharma.com/product/99.html)、[利福平胶囊 0.3g×50粒/瓶](https://www.hongqipharma.com/product/75.html)、[吡嗪酰胺片 0.25g×100片/瓶](https://www.hongqipharma.com/product/68.html)、[盐酸乙胺丁醇片 0.25g×100片/瓶](https://www.hongqipharma.com/product/54.html)。胶囊按“粒”计量。规格和厂家是已核对的产品资料；患者、发药量和用药安排仍为模拟数据，不是临床处方。

测试可以 `import { createMockServer } from './server.mjs'`，再调用 `createMockServer({now: '2026-09-08T04:00:00Z'})`；返回未监听的 `node:http.Server`，可用 `listen(0, '127.0.0.1')` 随机端口。`now` 也接受 Date 或返回 Date 的函数，便于验证过期和上海日期边界。每次创建实例都有独立数据，无外部副作用。
