# 本地 Mock API

仅用于前端开发演示，不启动或连接仓库中的 PHP 后台、MySQL、Redis、OSS、微信或 AI 服务。Node 22 及以上；所有业务数据、账号修改、会话与上传文件均在内存，重启服务后重置。

```sh
pnpm --dir mock-api install --frozen-lockfile
pnpm --dir mock-api start
pnpm --dir mock-api test
```

服务只监听 `127.0.0.1:3010`。前端通过 Vite `/api` 代理访问，代理需去掉 `/api` 前缀。健康检查 `GET /health`。演示账号 `admin` / `Mock123456`，验证码固定为 `1234`，每次登录仍须先取新的验证码 `uuid`（5 分钟有效）；登录会话 8 小时有效，停用账号、修改密码会使其已有会话失效。退出接口 `POST /app/core/logout` 幂等，只销毁当前会话。

患者端本地登录使用 `POST /app/login`，请求体为 `{ "mobile": "后台患者手机号" }`。只有已经由管理后台创建、且允许登录的患者档案会返回患者令牌；未知手机号返回 `code = 407`，不会自动创建患者。令牌可用于 `GET /app/patient/archive-detail`，`POST /app/logout` 退出。该接口只模拟“后台先建档、患者后登录”的业务门槛，不连接微信授权服务。

提供全部 30 个原 `/app/core` 接口、登录别名 `/app/admin/captcha` 与 `/app/admin/login`，另补个人中心资料、密码、登录/操作日志、图库和清缓存兼容接口。未知路径返回 HTTP 404，绝不转发。JSON 包装沿用 `{code,message,data}`，业务错误使用包装内错误码；列表分页使用 `current/size` 和 `{list,total,current,size}`。个人中心/图库的旧分页使用 `page/limit` 和 `{data,total,current_page,per_page,last_page}`。

上传 `POST /app/core/file/upload-file` 使用 multipart 字段 `file`，支持 JPG、PNG、GIF、PDF，最大 10 MB。返回 `/api/mock-files/:id` 同源 URL，原始字节在内存保存；图片出现在图库，文件可直接预览。导出问卷和不良反应生成真实 `.xlsx`，采用前端同版本 `xlsx ^0.18.5`；导出仅写入当前模拟数据。

种子包含 28 名全新的、明确标识的后台建档模拟患者，均有出生日期、独立的 11 位模拟手机号、患者端登录资格和有效研究分组；6 个研究分组覆盖 3 个模拟项目，每个项目各 2 个分组，所有患者分布在这 6 个分组中且不会重复归组。前 24 名患者关联 48 条用药及随访数据，后 4 名保留为空关联档案，用于验证空状态。另有当天/历史/未来计划、36 条不良反应、16 条常用药、13 篇文章、2 份问卷。保留部分近期建档患者用于未到填写日期状态，同时长期患者覆盖超过 30 天的未打卡计划；不会生成建档之前的计划。问卷 1 有 8 份模拟答卷，每份 6 题，问卷 2 为未作答草稿。问卷列表 `answerCount` 沿用后台 `COUNT(*)`，统计答案题目条数（初始 48），导出按答题患者每人一行。

所有日期以启动时上海日期生成；工作台指标、趋势及待办均从同一份明细计算。患者建档后创建药品与计划，用药天数以药品创建日期为第 1 天；上报不早于建档，答卷不早于问卷创建与允许填写日期。患者姓名、手机号、医院和资源均为虚构。代码中的示例用药内容仅为界面演示。

`GET /app/core/medication-plan/index` 额外支持可选 `as_of=YYYY-MM-DD`：在 `overdue=true` 时，逾期截止日和 `overdue_range` 起点以该日计算，保证历史工作台待办下钻与统计一致。缺省或非法日期仍使用上海当天；该参数不改变常规列表的 `scope=today` 行为，待办下钻应传 `scope=all,status=0,overdue=true`。

测试可以 `import { createMockServer } from './server.mjs'`，再调用 `createMockServer({now: '2026-09-08T04:00:00Z'})`；返回未监听的 `node:http.Server`，可用 `listen(0, '127.0.0.1')` 随机端口。`now` 也接受 Date 或返回 Date 的函数，便于验证过期和上海日期边界。每次创建实例都有独立数据，无外部副作用。
