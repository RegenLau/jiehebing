# 结核病随访管理小程序接口文档

## 通用说明

- 接口基础路径：`/app`
- 返回格式统一为：

```json
{
  "code": 0,
  "message": "成功",
  "data": {}
}
```

- `code = 0` 表示成功，其它值表示失败
- 除登录接口外，其它接口都需要在请求头中传 `Authorization`
- `loginTest` 为本地调试接口，不属于正式对外接口文档
- 患者端接口中，以下接口可在未建档时访问：`/app/patient/archive-detail`、`/app/patient/hospital-list`、`/app/patient/save-archive`
- 其余患者后续操作接口，以及 `/app/adverse-reaction/*`、`/app/health-article/*`、`/app/survey/*`、`/app/medicine/*` 均要求用户先完成建档

### 通用错误码

| code | 说明 |
| --- | --- |
| 0 | 成功 |
| 1 | 业务失败或参数错误 |
| 402 | 未登录或登录态失效 |
| 405 | 未绑定手机号 |
| 407 | 未建档，需先完成建档后再操作 |

### 未建档返回示例

```json
{
  "code": 407,
  "message": "请先完成建档",
  "data": []
}
```

## 1. 小程序登录

### 请求地址

`POST /app/login`

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| code | string | 是 | 微信小程序登录 code |

### 返回示例

```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "user": {
      "id": 1,
      "openid": "oUpxxxxxx",
      "unionid": "uxxxxxxx"
    },
    "token": {
      "token_type": "Bearer",
      "access_token": "xxxxx",
      "refresh_token": "xxxxx",
      "expires_in": 7200
    }
  }
}
```

## 2. 获取手机号

### 请求地址

`POST /app/digital/get-user-mobile`

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| code | string | 是 | 微信获取手机号 code |

### 返回示例

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "mobile": "18625755303"
  }
}
```

## 3. 获取患者建档详情

### 请求地址

`GET /app/patient/archive-detail`

### 返回说明

返回当前登录用户的建档信息。

### 返回示例

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "id": 1,
    "is_archived": 1,
    "hospital_id": 1,
    "hospital_name": "首都医科大学附属北京胸科医院",
    "department_name": "结核科",
    "visit_type": 2,
    "visit_type_text": "住院患者",
    "name": "张三",
    "gender": 2,
    "age": 35,
    "mobile": "18625755303"
  }
}
```

## 4. 获取药品清单

### 请求地址

`GET /app/patient/medicine-list`

### 接口说明

本接口要求用户先完成建档，未建档时返回 `code = 407`。

### 返回说明

返回当前登录用户的已保存药品列表。

- `medication_guidance`：根据药品 `ybm` 匹配 `tb_common_medicine.medication_guidance` 返回，没有数据时为空字符串

### 返回示例

```json
{
  "code": 0,
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "name": "异烟肼片",
      "specification": "100mg*14片/盒",
      "usage": "口服",
      "frequency": "每日1次",
      "dosage": "1片",
      "remark": "",
      "ybm": "86900000000001",
      "medication_guidance": "1. 建议按医嘱规律服药，不要自行漏服或停药。\n2. 如出现明显不适或异常反应，应及时咨询医生或药师。\n3. 与其他药物同时使用前，建议先确认是否存在相互作用风险。",
      "thumb": "https://example.com/medicine-1.png",
      "batch_no": "MED1202606221030001234",
      "sort": 1,
      "source": "ocr"
    }
  ]
}
```

## 5. 获取医院列表

### 请求地址

`GET /app/patient/hospital-list`

### 返回说明

返回医院列表，用于前端选择医院，不分页。

### 返回示例

```json
{
  "code": 0,
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "code": "BJXKY001",
      "name": "首都医科大学附属北京胸科医院"
    },
    {
      "id": 2,
      "code": "BJFK001",
      "name": "北京大学第一医院"
    }
  ]
}
```

## 6. 保存患者建档信息

### 请求地址

`POST /app/patient/save-archive`

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| hospital_id | int | 否 | 医院id，没有可不传 |
| hospital_name | string | 是 | 就诊医院名称 |
| department_name | string | 是 | 就诊科室名称 |
| visit_type | int | 是 | 就诊类型，`1=门诊患者`，`2=住院患者` |
| name | string | 是 | 患者姓名 |
| gender | int | 是 | 性别，`1=男`，`2=女` |
| age | int | 是 | 年龄 |

### 请求示例

```json
{
  "hospital_id": 1,
  "hospital_name": "首都医科大学附属北京胸科医院",
  "department_name": "结核科",
  "visit_type": 2,
  "name": "张三",
  "gender": 2,
  "age": 35
}
```

### 返回示例

```json
{
  "code": 0,
  "message": "保存成功",
  "data": {
    "id": 1,
    "is_archived": 1,
    "hospital_id": 1,
    "hospital_name": "首都医科大学附属北京胸科医院",
    "department_name": "结核科",
    "visit_type": 2,
    "visit_type_text": "住院患者",
    "name": "张三",
    "gender": 2,
    "age": 35,
    "mobile": "18625755303"
  }
}
```

## 7. 获取提醒设置

### 请求地址

`GET /app/patient/reminder-setting`

### 接口说明

本接口要求用户先完成建档，未建档时返回 `code = 407`。

### 返回说明

返回当前登录用户的提醒作息时间设置。

### 返回示例

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "breakfast_time": "07:00",
    "lunch_time": "11:30",
    "dinner_time": "18:00",
    "sleep_time": "21:00"
  }
}
```

## 8. 保存提醒设置

### 请求地址

`POST /app/patient/save-reminder-setting`

### 接口说明

本接口同时支持首次保存和后续修改，请求和返回仍使用四个时间字段，服务端统一保存到 `tb_user.reminder_setting` 一个字段中。
本接口要求用户先完成建档，未建档时返回 `code = 407`。

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| breakfast_time | string | 是 | 早餐时间，格式 `HH:MM` |
| lunch_time | string | 是 | 午餐时间，格式 `HH:MM` |
| dinner_time | string | 是 | 晚餐时间，格式 `HH:MM` |
| sleep_time | string | 是 | 睡觉时间，格式 `HH:MM` |

### 请求示例

```json
{
  "breakfast_time": "07:00",
  "lunch_time": "11:30",
  "dinner_time": "18:00",
  "sleep_time": "21:00"
}
```

### 返回示例

```json
{
  "code": 0,
  "message": "保存成功",
  "data": {
    "breakfast_time": "07:00",
    "lunch_time": "11:30",
    "dinner_time": "18:00",
    "sleep_time": "21:00"
  }
}
```

## 9. 处方识别

### 请求地址

`POST /app/patient/recognize-prescription`

### 接口说明

本接口要求用户先完成建档，未建档时返回 `code = 407`。

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| image | string | 是 | 处方图片 base64 内容，不带 data:image 前缀 |

说明：当前图片上传仅支持 `image/jpeg`、`image/jpg`、`image/png` 格式的 base64 图片内容。

### 返回说明

接口会先上传图片，再调用 OCR 识别，结果返回给前端确认，接口本身不直接落库。
`data.medicines` 的每个子项字段与“保存药品清单”接口的 `medicines` 子项保持一致，前端确认后可直接提交到 `POST /app/patient/save-medicines`。

### 返回示例

```json
{
  "code": 0,
  "message": "识别成功",
  "data": {
    "url": "https://health-h5.oss-cn-beijing.aliyuncs.com/tb-follow/xxx.jpg",
    "medicines": [
      {
        "name": "醋酸泼尼松片",
        "specification": "5mg*100片/瓶",
        "usage": "口服",
        "frequency": 1,
        "dosage": "30mg",
        "dosage_value": "30",
        "dosage_unit": "mg",
        "remark": "",
        "trade_name": "华意",
        "company": "华中药业股份有限公司",
        "medicine_count": "2瓶",
        "ybm": "XH02ABP059A001010101884",
        "thumb": "https://health-h5.oss-cn-beijing.aliyuncs.com/attachment/images/medicine/6acfa364b629adddb223e830c7c69ffa.jpg",
        "source": "ocr"
      }
    ]
  }
}
```

## 10. 保存药品清单

### 请求地址

`POST /app/patient/save-medicines`

### 接口说明

本接口用于新增一批药品，不会删除用户已有药品，也不会影响历史用药计划。
本次新增的药品会自动生成同一批次号，并从当天开始生成默认 180 天用药计划。
当 `frequency = 2` 时，系统会优先按“早餐时间 + 晚餐时间”生成当天两次提醒。
本接口要求用户先完成建档，未建档时返回 `code = 407`。

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| medicines | array | 是 | 药品列表 |

### medicines 子项字段

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 是 | 药品名称 |
| specification | string | 否 | 规格 |
| usage | string | 否 | 服用方式 |
| frequency | int | 否 | 用药频次，表示每天几次 |
| dosage | string | 否 | 每次剂量，兼容原字段 |
| dosage_value | string | 否 | 每次剂量数量 |
| dosage_unit | string | 否 | 每次剂量单位 |
| remark | string | 否 | 备注 |
| trade_name | string | 否 | 商品名 |
| company | string | 否 | 厂家 |
| medicine_count | string | 否 | 数量 |
| ybm | string | 否 | 药品医保码 |
| thumb | string | 否 | 药品图片 |
| source | string | 否 | 来源，`manual` 或 `ocr` |

### 请求示例

```json
{
  "medicines": [
    {
      "name": "异烟肼片",
      "specification": "100mg*14片/盒",
      "usage": "口服",
      "frequency": 1,
      "dosage": "1片",
      "dosage_value": "1",
      "dosage_unit": "片",
      "remark": "",
      "trade_name": "雷易得",
      "company": "示例制药有限公司",
      "medicine_count": "2盒",
      "ybm": "86900000000001",
      "thumb": "https://example.com/medicine-1.png",
      "source": "ocr"
    },
    {
      "name": "维生素B6片",
      "specification": "10mg*100片/瓶",
      "usage": "口服",
      "frequency": 3,
      "dosage": "1片",
      "dosage_value": "1",
      "dosage_unit": "片",
      "remark": "",
      "trade_name": "",
      "company": "",
      "medicine_count": "",
      "ybm": "86900000000002",
      "thumb": "https://example.com/medicine-2.png",
      "source": "manual"
    }
  ]
}
```

## 11. 修改药品信息

### 请求地址

`POST /app/patient/update-medicine`

### 接口说明

本接口仅修改单个药品信息，不会删除该药品的历史用药计划。
修改后只会同步更新明天及以后未执行的计划内容，不会重建计划记录。
当 `frequency = 2` 时，系统会优先按“早餐时间 + 晚餐时间”生成当天两次提醒。
本接口要求用户先完成建档，未建档时返回 `code = 407`。

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | int | 是 | 药品ID |
| name | string | 是 | 药品名称 |
| specification | string | 否 | 规格 |
| usage | string | 否 | 服用方式 |
| frequency | int | 否 | 用药频次，表示每天几次 |
| dosage | string | 否 | 每次剂量，兼容原字段 |
| dosage_value | string | 否 | 每次剂量数量 |
| dosage_unit | string | 否 | 每次剂量单位 |
| remark | string | 否 | 备注 |
| trade_name | string | 否 | 商品名 |
| company | string | 否 | 厂家 |
| medicine_count | string | 否 | 数量 |
| ybm | string | 否 | 药品医保码 |
| thumb | string | 否 | 药品图片 |

### 请求示例

```json
{
  "id": 1,
  "name": "诺欣妥·沙库巴曲缬沙坦钠片",
  "specification": "100mg*14片/盒",
  "usage": "口服",
  "frequency": 2,
  "dosage": "1片",
  "dosage_value": "1",
  "dosage_unit": "片",
  "remark": "",
  "trade_name": "雷易得",
  "company": "示例制药有限公司",
  "medicine_count": "2盒",
  "ybm": "86900000000001",
  "thumb": "https://example.com/medicine-1.png"
}
```

## 12. 获取康复计划概览

### 请求地址

`GET /app/patient/medication-plan`

### 接口说明

本接口要求用户先完成建档，未建档时返回 `code = 407`。

### 返回说明

返回当前治疗进度和今日打卡汇总信息。

### 返回示例

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "current_day": 15,
    "total_days": 180,
    "progress_percent": 8.33,
    "current_batch_no": "MED1202606221030001234",
    "today_total": 6,
    "today_completed": 1,
    "today_pending": 5,
    "status": "ongoing",
    "status_text": "正常治疗中"
  }
}
```

## 13. 获取今日用药打卡列表

### 请求地址

`GET /app/patient/today-medication-plans`

### 接口说明

本接口要求用户先完成建档，未建档时返回 `code = 407`。

### 返回说明

返回当天需要打卡的用药计划列表。

### 返回示例

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "summary": {
      "date": "2026-06-22",
      "total": 6,
      "completed": 1
    },
    "list": [
      {
        "id": 1,
        "medicine_id": 2,
        "batch_no": "MED1202606221030001234",
        "plan_date": "2026-06-22",
        "day_number": 15,
        "plan_time": "07:00",
        "plan_index": 1,
        "name": "利福平胶囊",
        "specification": "0.45g",
        "usage": "早餐后",
        "frequency": 1,
        "dosage": "1粒",
        "dosage_value": "1",
        "dosage_unit": "粒",
        "thumb": "https://example.com/medicine-1.png",
        "status": 0,
        "status_text": "待打卡",
        "checked_at": ""
      }
    ]
  }
}
```

## 14. 用药打卡

### 请求地址

`POST /app/patient/check-medication-plan`

### 接口说明

本接口要求用户先完成建档，未建档时返回 `code = 407`。

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| plan_id | int | 是 | 当天用药计划ID |

### 请求示例

```json
{
  "plan_id": 1
}
```

### 返回示例

```json
{
  "code": 0,
  "message": "打卡成功",
  "data": {
    "summary": {
      "date": "2026-06-22",
      "total": 6,
      "completed": 2
    },
    "list": []
  }
}
```

## 15. 不良反应上报

### 请求地址

`POST /app/adverse-reaction/report`

### 接口说明

本接口要求用户先完成建档，未建档时返回 `code = 407`。

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| occurred_at | string | 是 | 发生时间，格式 `YYYY-MM-DD HH:mm` |
| symptoms | array | 是 | 主要症状，多选 |
| symptom_description | string | 否 | 症状描述 |
| severity | int | 是 | 严重程度，`1=轻度`、`2=中度`、`3=重度` |

### 请求示例

```json
{
  "occurred_at": "2026-01-16 14:30",
  "symptoms": ["恶心呕吐", "腹泻腹痛"],
  "symptom_description": "吃药后半小时开始恶心，持续2小时，同时有腹痛。",
  "severity": 2
}
```

### 返回示例

```json
{
  "code": 0,
  "message": "上报成功",
  "data": {
    "id": 1,
    "occurred_at": "2026-01-16 14:30:00",
    "symptoms": ["恶心呕吐", "腹泻腹痛"],
    "symptom_description": "吃药后半小时开始恶心，持续2小时，同时有腹痛。",
    "severity": 2,
    "severity_text": "中度",
    "advice_text": "症状已影响吃饭、睡觉或日常活动，请尽快联系随访医生，由医生判断是否需要检查或调整用药。",
    "status": 1,
    "created_at": "2026-01-16 14:35:00"
  }
}
```

## 16. 不良反应上报记录

### 请求地址

`GET /app/adverse-reaction/list`

### 接口说明

本接口要求用户先完成建档，未建档时返回 `code = 407`。

### 返回说明

返回当前登录用户的不良反应上报记录列表，按最新上报倒序。

### 返回示例

```json
{
  "code": 0,
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "occurred_at": "2026-01-16 14:30:00",
      "symptoms": ["恶心呕吐", "腹泻腹痛"],
      "symptom_description": "吃药后半小时开始恶心，持续2小时，同时有腹痛。",
      "severity": 2,
      "severity_text": "中度",
      "advice_text": "症状已影响吃饭、睡觉或日常活动，请尽快联系随访医生，由医生判断是否需要检查或调整用药。",
      "status": 1,
      "created_at": "2026-01-16 14:35:00"
    }
  ]
}
```

## 17. 健康科普列表

### 请求地址

`GET /app/health-article/list`

### 接口说明

本接口要求用户先完成建档，未建档时返回 `code = 407`。

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | int | 否 | 页码，默认 `1` |
| page_size | int | 否 | 每页数量，默认 `10`，最大 `100` |

### 返回说明

返回已上架的健康科普文章分页列表，按排序值倒序、文章ID倒序返回。

### 返回示例

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "list": [
      {
        "id": 3,
        "title": "结核病患者居家用药注意事项",
        "cover": "https://example.com/article-cover-1.png",
        "summary": "规律服药、按时复诊、留意不良反应，是提高治疗依从性的关键。",
        "view_count": 126,
        "sort": 100,
        "published_at": "2026-06-23 10:00:00"
      },
      {
        "id": 2,
        "title": "如何正确保存抗结核药物",
        "cover": "https://example.com/article-cover-2.png",
        "summary": "药品应避光、避潮保存，并放置在儿童接触不到的位置。",
        "view_count": 58,
        "sort": 80,
        "published_at": "2026-06-20 09:30:00"
      }
    ],
    "total": 12,
    "per_page": 10,
    "current_page": 1,
    "last_page": 2
  }
}
```

## 18. 健康科普详情

### 请求地址

`GET /app/health-article/detail`

### 接口说明

本接口要求用户先完成建档，未建档时返回 `code = 407`。

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | int | 是 | 文章ID |

### 返回说明

返回文章详情；每次成功获取详情时，浏览量会自动加 `1`。

### 返回示例

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "id": 3,
    "title": "结核病患者居家用药注意事项",
    "cover": "https://example.com/article-cover-1.png",
    "summary": "规律服药、按时复诊、留意不良反应，是提高治疗依从性的关键。",
    "content": "<p>请按照医嘱规律用药，不要自行停药、减量或漏服。</p><p>如出现明显不适，请及时联系医生。</p>",
    "view_count": 127,
    "sort": 100,
    "published_at": "2026-06-23 10:00:00",
    "created_at": "2026-06-23 09:50:00"
  }
}
```

## 19. 获取问卷模板列表

### 请求地址

`GET /app/survey/templates`

### 接口说明

本接口要求用户先完成建档，未建档时返回 `code = 407`。

### 返回说明

返回当前登录患者所有启用的问卷模板列表，用于获取 `template_code` 后再调用"获取问卷"或"提交答案"接口。

- 无论是否到达可填写时间，模板都会返回。
- `fillableDate` 表示可填写的具体日期（建档日期 + `fillable_day`，格式 `Y-m-d`），未建档时为 `null`。
- `fillable` 表示当前是否到达可填写时间（`today >= fillableDate`），`false` 时前端应禁止作答。
- `answered` 表示该患者是否已提交过该模板的答案，`true` 时前端可标记为"已填写"。

### 返回示例

```json
{
  "code": 0,
  "message": "获取成功",
  "data": [
    {
      "templateId": 1,
      "code": "TB_FOLLOWUP_V1",
      "name": "结核病随访问卷",
      "description": "请根据您真实感受填写，数据用于评估治疗效果。",
      "fillableDay": 7,
      "fillableDate": "2026-06-08",
      "fillable": true,
      "answered": false
    }
  ]
}
```

## 20. 获取随访问卷

### 请求地址

`GET /app/survey/detail`

### 接口说明

本接口要求用户先完成建档，未建档时返回 `code = 407`。

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| template_code | string | 是 | 模板编码，如 `TB_FOLLOWUP_V1` |

### 返回说明

根据当前登录患者的建档日期（`tb_user.enroll_date`）与模板 `fillable_day` 判断是否到达可填写时间：

- 未到时间：`fillable=false`，`questions` 为空数组，仅返回模板基本信息（含 `fillableDate` 可填写日期），前端可提示"X月X日可填写"。
- 已到时间：`fillable=true`，返回完整题目与选项列表供填写。

`options[].triggerInput=true` 的选项被选中时，需展开 `inputFields` 中的条件输入框；`options[].isExclusive=true` 的选项（如"以上都没有"）在多选题中与其他选项互斥。

### 返回示例（已到可填写时间）

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "templateId": 2,
    "code": "TB_FOLLOWUP_V1",
    "name": "结核病随访问卷",
    "description": "请根据您真实感受填写，数据用于评估治疗效果。",
    "fillableDay": 7,
    "fillableDate": "2026-06-08",
    "fillable": true,
    "questions": [
      {
        "questionId": 7,
        "questionNo": 1,
        "title": "您最近有无新增或减少药物？",
        "type": "RADIO",
        "required": true,
        "sortOrder": 1,
        "options": [
          { "id": 14, "label": "首次开药", "triggerInput": false },
          { "id": 15, "label": "没有变化", "triggerInput": false },
          {
            "id": 16,
            "label": "有，药名：___________________",
            "triggerInput": true,
            "inputFields": [
              { "field_key": "drug_name", "field_label": "药名", "field_type": "text", "required": true, "placeholder": "请填写药名" }
            ]
          }
        ]
      },
      {
        "questionId": 8,
        "questionNo": 2,
        "title": "您最近服用药物的剂量和频次是否有变化？",
        "type": "RADIO",
        "required": true,
        "sortOrder": 2,
        "options": [
          { "id": 17, "label": "没有", "triggerInput": false },
          {
            "id": 18,
            "label": "有，药名：___ 频次变化：___",
            "triggerInput": true,
            "inputFields": [
              { "field_key": "drug_name", "field_label": "药名", "field_type": "text", "required": true, "placeholder": "请填写药名" },
              { "field_key": "frequency_change", "field_label": "频次变化", "field_type": "text", "required": true, "placeholder": "如：一天半片" }
            ]
          }
        ]
      },
      {
        "questionId": 9,
        "questionNo": 3,
        "title": "最近2周内，有没有以下情况？（可多选）",
        "type": "CHECKBOX",
        "required": true,
        "sortOrder": 3,
        "options": [
          { "id": 19, "label": "忘记吃药", "triggerInput": false },
          { "id": 20, "label": "自己减量或停药", "triggerInput": false },
          { "id": 21, "label": "自行增加剂量", "triggerInput": false },
          { "id": 22, "label": "以上都没有", "triggerInput": false, "isExclusive": true }
        ]
      },
      {
        "questionId": 10,
        "questionNo": 4,
        "title": "您最想问药师或医生的用药问题是：",
        "type": "TEXT",
        "required": false,
        "sortOrder": 4,
        "placeholder": "请输入您的问题",
        "options": []
      },
      {
        "questionId": 11,
        "questionNo": 5,
        "title": "服药以后有没有出现不舒服（如头晕、皮疹、恶心等）？",
        "type": "RADIO",
        "required": true,
        "sortOrder": 5,
        "options": [
          { "id": 23, "label": "没有", "triggerInput": false },
          {
            "id": 24,
            "label": "有，不舒服表现：___",
            "triggerInput": true,
            "inputFields": [
              { "field_key": "symptom", "field_label": "不舒服表现", "field_type": "text", "required": true, "placeholder": "如：头晕、皮疹" }
            ]
          }
        ]
      }
    ]
  }
}
```

### 返回示例（未到可填写时间）

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "templateId": 1,
    "code": "TB_FOLLOWUP_V1",
    "name": "结核病随访问卷",
    "description": "请根据您真实感受填写，数据用于评估治疗效果。",
    "fillableDay": 7,
    "fillableDate": "2026-07-08",
    "fillable": false,
    "questions": []
  }
}
```

## 21. 提交随访问卷答案

### 请求地址

`POST /app/survey/submit`

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| template_code | string | 是 | 模板编码 |
| answers | array | 是 | 答案列表 |
| answers[].questionId | int | 是 | 题目ID |
| answers[].optionIds | int[] | 选择题必填 | 选中的选项ID数组 |
| answers[].extraInputs | object | 条件填空 | 触发选项展开的输入内容，key 与 `inputFields[].field_key` 对应；当一个选项有多个输入字段时需全部填写 |
| answers[].textValue | string | 文本题 | 开放问题文本，≤500字符 |

### 接口说明

- 本接口要求用户先完成建档，未建档时返回 `code = 407`
- 未到可填写时间提交返回 `code=1`，message 提示"未到可填写时间"
- 同一患者同一模板已提交过返回 `code=1`，message 提示"您已填写过该问卷，不可重复提交"
- 单选题 `optionIds` 长度必须为 1
- 多选题 `optionIds` 至少 1 个；含 `isExclusive` 选项时不可同时选其他
- `triggerInput=true` 的选项被选中时，其 `inputFields` 中 `required=true` 的字段必填；一个选项配置了多个输入字段时，`extraInputs` 中需按 `field_key` 逐一填写
- 文本题 `required=true` 时必填，长度 ≤500
- 所有错误统一返回 `code=1`，具体错误原因见 `message`

### 请求示例

```json
{
  "template_code": "TB_FOLLOWUP_V1",
  "answers": [
    {
      "questionId": 7,
      "optionIds": [16],
      "extraInputs": { "drug_name": "利福平胶囊" }
    },
    {
      "questionId": 8,
      "optionIds": [18],
      "extraInputs": { "drug_name": "异烟肼片", "frequency_change": "一天半片" }
    },
    {
      "questionId": 9,
      "optionIds": [19, 20]
    },
    {
      "questionId": 10,
      "textValue": "吃药后胃不舒服怎么办？"
    },
    {
      "questionId": 11,
      "optionIds": [24],
      "extraInputs": { "symptom": "偶尔头晕" }
    }
  ]
}
```

> **`extraInputs` 说明：**
> - key 对应选项 `inputFields` 中的 `field_key`
> - 当选项只有一个输入字段时填写一项，如 Q1 选"有"只需填 `drug_name`
> - 当选项有多个输入字段时需全部填写，如 Q2 选"有"需同时填 `drug_name` 和 `frequency_change`

### 返回示例

```json
{
  "code": 0,
  "message": "提交成功",
  "data": {
    "submittedAt": "2026-06-26 15:02:16"
  }
}
```

## 22. 常用药列表

### 请求地址

`POST /app/medicine/common-list`

### 接口说明

本接口要求用户先完成建档，未建档时返回 `code = 407`。

### 请求参数（Body，JSON）

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | int | 否 | 页码，默认 1 |
| page_size | int | 否 | 每页数量，默认 20，最大 100 |
| keyword | string | 否 | 按品种名/生产厂家模糊搜索 |

### 返回说明

分页返回启用的常用药，按 `sort_order` 升序排列。支持按品种名或厂家搜索。

- `ybm`：药品医保码
- `usage`：服用方式，没有数据时返回空字符串
- `frequency`：每天服药几次，没有数据时默认返回 `1`
- `dosage`：每次剂量完整描述，没有数据时返回空字符串
- `dosage_value`：每次剂量数量部分，没有数据时返回空字符串
- `dosage_unit`：每次剂量单位部分，没有数据时返回空字符串
- `medication_guidance`：用药指导，没有数据时返回空字符串

### 返回示例

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "list": [
      {
        "id": 1,
        "commonName": "阿奇霉素片",
        "company": "石药集团欧意药业有限公司",
        "specification": "0.25g*6片",
        "ybm": "86901234000001",
        "usage": "口服",
        "frequency": 2,
        "dosage": "1片",
        "dosage_value": "1",
        "dosage_unit": "片",
        "medication_guidance": "1. 建议按医嘱规律服药，不要自行增减剂量。\n2. 服药期间如出现明显胃肠不适、皮疹等异常情况，应及时咨询医生。\n3. 与其他药物同服前，建议先确认是否存在相互作用风险。",
        "thumb": "https://health-h5.oss-cn-beijing.aliyuncs.com/..."
      },
      {
        "id": 2,
        "commonName": "吡嗪酰胺片",
        "company": "广东华南制药厂",
        "specification": "0.25g*100片",
        "ybm": "86901234000002",
        "usage": "口服",
        "frequency": 1,
        "dosage": "15～30mg/kg",
        "dosage_value": "15～30",
        "dosage_unit": "mg/kg",
        "medication_guidance": "",
        "thumb": ""
      }
    ],
    "total": 39,
    "per_page": 20,
    "current_page": 1,
    "last_page": 2
  }
}
```

## 23. 常用药详情

### 请求地址

`GET /app/medicine/common-detail`

### 接口说明

本接口要求用户先完成建档，未建档时返回 `code = 407`。

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | int | 是 | 常用药ID |

### 返回说明

返回常用药基本信息、用药指导和药品说明书。

- `usage`：服用方式，没有数据时返回空字符串
- `frequency`：每天服药几次，没有数据时默认返回 `1`
- `dosage`：每次剂量完整描述，没有数据时返回空字符串
- `dosage_value`：每次剂量数量部分，没有数据时返回空字符串
- `dosage_unit`：每次剂量单位部分，没有数据时返回空字符串
- `medication_guidance`：对应 `tb_common_medicine.medication_guidance`，没有数据时返回空字符串

说明书按 `fullVersionIndex` 顺序排列，每个段落包含：

- `key`：字段标识（对应药品说明书原始字段名）
- `title`：中文标题（来自 `displayNameMap` 的翻译）
- `value`：说明书正文（HTML 格式，前端可直接渲染）

如果该药品暂无说明书数据，`instruction` 返回空数组。

### 返回示例

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "id": 1,
    "commonName": "阿奇霉素片",
    "company": "石药集团欧意药业有限公司",
    "specification": "0.25g*6片",
    "usage": "口服",
    "frequency": 2,
    "dosage": "1片",
    "dosage_value": "1",
    "dosage_unit": "片",
    "thumb": "https://health-h5.oss-cn-beijing.aliyuncs.com/...",
    "medication_guidance": "1. 建议饭前1小时或饭后2小时服用，按医生或说明书要求按时按量服药。\n2. 如果服药后出现明显胃部不适、皮疹等情况，要及时咨询医生。\n3. 不要自行和其他抗菌药同时长期使用，以免影响疗效或增加不良反应风险。",
    "instruction": [
      {
        "key": "drugName",
        "title": "药品名称",
        "value": "通用名称：阿奇霉素片<br/>商品名称：爱奇美<br/>英文名称：Azithromycin Tablets<br/>汉语拼音：Aqimeisu Pian"
      },
      {
        "key": "indication",
        "title": "适应症",
        "value": "1.化脓性链球菌引起的急性咽炎、急性扁桃体炎。2.敏感细菌引起的鼻窦炎、急性中耳炎..."
      },
      {
        "key": "dosage",
        "title": "用法用量",
        "value": "口服，在饭前1小时或饭后2小时服用。..."
      },
      {
        "key": "adverseReaction",
        "title": "不良反应",
        "value": "本品一般耐受性良好，不良反应发生率较低..."
      },
      {
        "key": "contraindication",
        "title": "禁忌",
        "value": "对阿奇霉素、红霉素或其他任何一种大环内酯类药物过敏者禁用。"
      },
      {
        "key": "precaution",
        "title": "注意事项",
        "value": "1.进食可能影响阿奇霉素的吸收, 故需在饭前1小时或饭后2小时口服。..."
      }
    ]
  }
}
```
