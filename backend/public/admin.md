# 管理后台接口文档

> 后台接口复用患者端登录态（需带 `Authorization` 头）。

---

## 1. 问卷管理 — 模板列表

### 请求地址

`GET /app/admin/survey/template/list`

### 请求参数（Query）

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | int | 否 | 页码，默认 1 |
| page_size | int | 否 | 每页条数，默认 20，最大 100 |
| keyword | string | 否 | 按 name/code 模糊搜索 |
| status | int | 否 | 0=停用 1=启用，不传则全部 |

### 返回示例

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "list": [
      {
        "id": 1,
        "code": "TB_FOLLOWUP_V1",
        "name": "结核病随访问卷",
        "description": "请根据您真实感受填写，数据用于评估治疗效果。",
        "fillableDay": 7,
        "status": 1,
        "questionCount": 6,
        "answerCount": 12,
        "createdAt": "2026-06-25 10:00:00"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

---

## 2. 问卷管理 — 模板详情

### 请求地址

`GET /app/admin/survey/template/detail`

### 请求参数（Query）

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | int | 是 | 模板ID |

### 返回说明

返回完整模板树（模板信息 + 题目 + 每题选项），供后台编辑表单回显。`questions[].options[].inputFields` 仅在 `triggerInput=true` 时返回。

### 返回示例

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "id": 1,
    "code": "TB_FOLLOWUP_V1",
    "name": "结核病随访问卷",
    "description": "请根据您真实感受填写，数据用于评估治疗效果。",
    "fillableDay": 7,
    "status": 1,
    "createdAt": "2026-06-25 10:00:00",
    "updatedAt": "2026-06-25 10:00:00",
    "questions": [
      {
        "id": 101,
        "questionNo": 1,
        "title": "您最近有无新增或减少药物？",
        "type": "RADIO",
        "required": 1,
        "sortOrder": 1,
        "placeholder": "",
        "options": [
          { "id": 1, "label": "首次开药", "sortOrder": 1, "isExclusive": false, "triggerInput": false, "inputFields": null },
          {
            "id": 3,
            "label": "有",
            "sortOrder": 3,
            "isExclusive": false,
            "triggerInput": true,
            "inputFields": [
              { "field_key": "drug_name", "field_label": "药名", "field_type": "text", "required": true, "placeholder": "请填写药名" }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## 3. 问卷管理 — 新建/更新模板

### 请求地址

`POST /app/admin/survey/template/save`

### 请求参数（Body，JSON）

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | int | 否 | 不传=新建，传=更新 |
| code | string | 是 | 模板编码，全局唯一，≤64 |
| name | string | 是 | 模板名称，≤128 |
| description | string | 否 | 问卷说明，≤256 |
| fillable_day | int | 是 | 患者第几天可填写（相对建档日期），≥0 |
| status | int | 是 | 0=停用 1=启用 |
| questions | array | 是 | 题目列表，至少 1 题 |
| questions[].id | int | 否 | 不传=新增该题，传=更新该题 |
| questions[].question_no | int | 是 | 题号，模板内唯一，≥1 |
| questions[].title | string | 是 | 题干，≤512 |
| questions[].type | string | 是 | `RADIO`/`CHECKBOX`/`TEXT` |
| questions[].required | int | 是 | 0/1 |
| questions[].sort_order | int | 是 | 展示顺序，≥0 |
| questions[].placeholder | string | 否 | 文本题占位提示，≤256 |
| questions[].options | array | 选择题必填 | 选项列表（TEXT 题忽略） |
| questions[].options[].id | int | 否 | 不传=新增该选项，传=更新 |
| questions[].options[].label | string | 是 | 选项文案，≤128 |
| questions[].options[].sort_order | int | 是 | ≥0 |
| questions[].options[].is_exclusive | int | 是 | 0/1，多选题互斥项 |
| questions[].options[].trigger_input | int | 是 | 0/1，选中是否展开条件输入 |
| questions[].options[].input_fields | array | trigger_input=1 时必填 | 条件输入字段，每项含 `field_key`/`field_label` |

### 接口说明

- 采用 upsert-by-id：带 `id` 的题目/选项为更新，不带 `id` 的为新增，已存在但 payload 未提交的会被删除。
- **已有作答记录的模板**：禁止删除题目/选项、禁止修改题目 `type`（答案通过题目 ID、选项 ID 引用，变更会导致历史数据错乱）；可改文案、排序、必填、占位、互斥、触发输入、`input_fields`，可新增题目/选项，可改模板元数据。如需大改结构请停用后新建。
- 模板 `code` 全局唯一；题型仅限三类；RADIO/CHECKBOX 题至少 1 个选项。

### 请求示例（新建）

```json
{
  "code": "TB_FOLLOWUP_V2",
  "name": "结核病随访第二期",
  "description": "",
  "fillable_day": 30,
  "status": 1,
  "questions": [
    {
      "question_no": 1,
      "title": "最近有无漏服药物？",
      "type": "RADIO",
      "required": 1,
      "sort_order": 1,
      "placeholder": "",
      "options": [
        { "label": "有", "sort_order": 1, "is_exclusive": 0, "trigger_input": 1, "input_fields": [{ "field_key": "times", "field_label": "漏服次数", "field_type": "text", "required": true }] },
        { "label": "没有", "sort_order": 2, "is_exclusive": 0, "trigger_input": 0 }
      ]
    },
    {
      "question_no": 2,
      "title": "请补充说明",
      "type": "TEXT",
      "required": 0,
      "sort_order": 2,
      "placeholder": "请输入",
      "options": []
    }
  ]
}
```

### 返回示例

```json
{
  "code": 0,
  "message": "保存成功",
  "data": { "id": 2 }
}
```

---

## 4. 问卷管理 — 删除模板

### 请求地址

`POST /app/admin/survey/template/delete`

### 请求参数（Body）

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | int | 是 | 模板ID |

### 接口说明

- 模板已有作答记录时拒绝删除，返回 `code=1`，提示改为停用。
- 删除将级联清除该模板下的题目与选项。

### 返回示例

```json
{ "code": 0, "message": "删除成功", "data": { "id": 2 } }
```

---

## 5. 问卷管理 — 启用/停用模板

### 请求地址

`POST /app/admin/survey/template/toggle-status`

### 请求参数（Body）

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | int | 是 | 模板ID |
| status | int | 是 | 0=停用 1=启用 |

### 返回示例

```json
{ "code": 0, "message": "操作成功", "data": { "id": 1, "status": 0 } }
```
