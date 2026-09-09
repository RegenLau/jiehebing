# TB-Follow 结核病随访管理系统

基于 Webman（Workerman）框架的结核病患者随访管理后端服务。

## 技术栈

- **框架**：Webman 2.1（PHP >= 8.1）
- **数据库**：Illuminate ORM（webman/database）
- **缓存/队列**：Redis + webman/redis-queue
- **鉴权**：tinywan/jwt
- **依赖注入**：PHP-DI
- **文件存储**：webman-filesystem + 阿里云 OSS
- **定时任务**：workerman/crontab
- **其他**：easyhttp、webman-lock

## 功能模块

- 患者管理（`PatientController`）
- 登录鉴权（`LoginController`）
- 微信对接（`WechatController`）
- 用药 / 服药计划（作息时间）
- 不良反应上报（`AdverseReactionController`）
- 科普文章（`HealthArticleController`）
- 文件上传（`FileController`）
- AI 服务、队列消费、定时任务

## 目录结构

```
app/
  controller/    控制器
  middleware/    中间件
  model/         模型
  services/      服务层（wechat / patient / ai）
  queue/         队列消费
  process/       自定义进程
  exception/     异常处理
config/          配置
public/          静态资源
support/         框架辅助
```

## 运行

```bash
composer install
php start.php start        # 前台调试
php start.php start -d     # 守护进程
```

## 环境配置

- `.env` / `.env.dev` / `.env.pro` 多环境配置
- 支持 Docker 部署（Dockerfile + docker-compose.yml）
