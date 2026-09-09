import assert from 'node:assert/strict'
import { once } from 'node:events'
import { inflateRawSync } from 'node:zlib'
import { test } from 'node:test'
import { createMockServer } from '../server.mjs'

const NOW = '2026-09-08T04:00:00.000Z'
const TODAY = '2026-09-08'
const PASSWORD = 'Mock123456'
const P = '/app/core/'
const ids = (rows) => rows.map((row) => row.id).sort((a, b) => a - b)
const sum = (values) => values.reduce((total, value) => total + value, 0)

async function start(t, now = NOW) {
  const server = createMockServer({ now })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
    server.closeAllConnections()
  }))
  let token = ''
  async function raw(path, { query, body, auth = token, method, headers = {} } = {}) {
    const url = new URL(path, base)
    if (query) for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value))
    if (auth) headers = { ...headers, Authorization: `Bearer ${auth}` }
    if (body !== undefined && !(body instanceof FormData)) {
      headers = { ...headers, 'Content-Type': 'application/json' }
      body = JSON.stringify(body)
    }
    return fetch(url, { method: method ?? (body === undefined ? 'GET' : 'POST'), headers, body })
  }
  async function json(path, options) {
    const response = await raw(path, options)
    assert.match(response.headers.get('content-type'), /application\/json/)
    return response.json()
  }
  async function ok(path, options) {
    const result = await json(path, options)
    assert.equal(result.code, 200, `${path}: ${JSON.stringify(result)}`)
    assert.equal(typeof result.message, 'string')
    return result.data
  }
  async function login(username = 'admin', password = PASSWORD) {
    const captcha = await ok(P + 'captcha', { auth: '' })
    const data = await ok(P + 'login', { auth: '', body: { username, password, uuid: captcha.uuid, code: '1234' } })
    assert.equal(typeof data.access_token, 'string')
    assert.ok(data.access_token.length > 10)
    token = data.access_token
    return token
  }
  async function all(path, query = {}) {
    const rows = []
    let total = Infinity
    for (let current = 1; rows.length < total && current <= 1000; current++) {
      const page = await ok(path, { query: { ...query, current, size: 100 } })
      assert.equal(page.current, current)
      assert.ok(Array.isArray(page.list))
      total = page.total
      rows.push(...page.list)
      if (!page.list.length) break
    }
    assert.equal(rows.length, total, `${path} returns every page without early truncation`)
    assert.equal(new Set(rows.map((row) => row.id)).size, rows.length)
    return rows
  }
  return { raw, json, ok, login, all, get token() { return token } }
}

// Read the actual XLSX container independently of its writer, including compressed ZIP entries.
function workbookRows(buffer) {
  assert.equal(buffer.readUInt32LE(0), 0x04034b50, 'export is a ZIP based XLSX, not disguised JSON/CSV')
  let end = buffer.length - 22
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end--
  assert.ok(end >= 0, 'ZIP central directory exists')
  let cursor = buffer.readUInt32LE(end + 16)
  const count = buffer.readUInt16LE(end + 10)
  const entries = new Map()
  for (let index = 0; index < count; index++) {
    assert.equal(buffer.readUInt32LE(cursor), 0x02014b50)
    const compression = buffer.readUInt16LE(cursor + 10)
    const length = buffer.readUInt32LE(cursor + 20)
    const nameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    const offset = buffer.readUInt32LE(cursor + 42)
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString()
    const dataOffset = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28)
    const compressed = buffer.subarray(dataOffset, dataOffset + length)
    assert.ok(compression === 0 || compression === 8)
    entries.set(name, (compression === 8 ? inflateRawSync(compressed) : compressed).toString())
    cursor += 46 + nameLength + extraLength + commentLength
  }
  assert.ok(entries.has('[Content_Types].xml'))
  assert.ok(entries.has('xl/workbook.xml'))
  const decode = (text) => text.replace(/&#x([\da-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  const textNodes = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => decode(match[1])).join('')
  const shared = [...(entries.get('xl/sharedStrings.xml') ?? '').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((match) => textNodes(match[1]))
  const sheet = entries.get('xl/worksheets/sheet1.xml')
  assert.ok(sheet, 'first worksheet exists')
  return [...sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((row) => {
    const values = []
    for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const address = /\br="([A-Z]+)\d+"/.exec(cell[1])?.[1]
      const column = address ? [...address].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1 : values.length
      const type = /\bt="([^"]+)"/.exec(cell[1])?.[1]
      const xml = cell[2] ?? ''
      const value = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(xml)?.[1] ?? ''
      values[column] = type === 's' ? shared[Number(value)] : type === 'inlineStr' ? textNodes(xml) : decode(value)
    }
    return values
  })
}

test('captcha, login failures, bearer authentication, and unknown routes are isolated', async (t) => {
  const api = await start(t)
  const captcha = await api.ok(P + 'captcha')
  assert.ok(captcha.uuid)
  assert.match(captcha.image, /^data:image\//)
  const badCaptcha = await api.json(P + 'login', { body: { username: 'admin', password: PASSWORD, uuid: captcha.uuid, code: '0000' } })
  assert.notEqual(badCaptcha.code, 200)
  for (const [username, password] of [['admin', 'wrong-password'], ['missing-user', PASSWORD]]) {
    const fresh = await api.ok(P + 'captcha')
    assert.notEqual((await api.json(P + 'login', { body: { username, password, uuid: fresh.uuid, code: '1234' } })).code, 200)
  }
  assert.equal((await api.json(P + 'system/user')).code, 401)
  assert.equal((await api.json(P + 'system/user', { auth: 'invalid-token' })).code, 401)
  await api.login()
  assert.ok(await api.ok(P + 'system/user'))
  assert.ok(Array.isArray(await api.ok(P + 'system/menu')))
  assert.ok(await api.ok(P + 'system/dictAll'))
  const missing = await api.raw(P + 'does-not-exist')
  assert.equal(missing.status, 404)
  assert.equal((await missing.json()).code, 404)
  assert.equal((await api.json(P + 'patient/detail', { query: { user_id: 99999999 } })).code, 404)
  const signedOutToken = api.token
  await api.ok(P + 'logout', { body: {} })
  assert.equal((await api.json(P + 'system/user', { auth: signedOutToken })).code, 401)
})

test('patient pages, related medication/reaction records and explicit empty patient remain consistent', async (t) => {
  const api = await start(t)
  await api.login()
  const patients = await api.all(P + 'patient/index')
  assert.ok(patients.length > 20, 'seed supports actual pagination')
  const first = await api.ok(P + 'patient/index', { query: { current: 1, size: 7 } })
  const second = await api.ok(P + 'patient/index', { query: { current: 2, size: 7 } })
  assert.equal(first.list.length, 7)
  assert.equal(second.list.length, 7)
  assert.equal(first.total, patients.length)
  assert.ok(first.list.every((row) => !second.list.some((other) => row.id === other.id)))
  const plans = await api.all(P + 'medication-plan/index', { scope: 'all' })
  const reactions = await api.all(P + 'adverse-reaction/index')
  const patient = patients.find((row) => plans.some((plan) => plan.user_id === row.id))
  assert.ok(patient)
  assert.deepEqual(await api.ok(P + 'patient/detail', { query: { user_id: patient.id } }), patient)
  const medicines = await api.all(P + 'patient/medicine-list', { user_id: patient.id })
  assert.ok(medicines.length)
  const ownPlans = await api.all(P + 'medication-plan/index', { user_id: patient.id, scope: 'all' })
  assert.deepEqual(ids(ownPlans), ids(plans.filter((row) => row.user_id === patient.id)))
  assert.ok(ownPlans.every((row) => row.patient_name === patient.name && medicines.some((medicine) => medicine.id === row.medicine_id)))
  const ownReactions = await api.all(P + 'adverse-reaction/index', { user_id: patient.id })
  assert.deepEqual(ids(ownReactions), ids(reactions.filter((row) => row.user_id === patient.id)))
  assert.ok(ownReactions.every((row) => row.patient_name === patient.name))
  const empty = patients.find((row) => !plans.some((plan) => plan.user_id === row.id) && !reactions.some((reaction) => reaction.user_id === row.id))
  assert.ok(empty, 'seed provides a patient without associated records')
  assert.deepEqual(await api.all(P + 'patient/medicine-list', { user_id: empty.id }), [])
  assert.deepEqual(await api.all(P + 'medication-plan/index', { user_id: empty.id, scope: 'all' }), [])
  const statuses = await api.ok(P + 'patient/survey-status', { query: { user_id: empty.id } })
  assert.ok(statuses.every((row) => !row.answered && row.answer_count === 0))
})

test('medication and reaction filters include full history and precise overdue windows', async (t) => {
  const api = await start(t)
  await api.login()
  const plans = await api.all(P + 'medication-plan/index', { scope: 'all' })
  const selected = plans.find((row) => row.plan_date === TODAY)
  assert.ok(selected)
  for (const [query, predicate] of [
    [{ scope: 'today' }, (row) => row.plan_date === TODAY],
    [{ plan_date: selected.plan_date, status: 0 }, (row) => row.plan_date === selected.plan_date && row.status === 0],
    [{ patient_name: selected.patient_name }, (row) => row.patient_name.includes(selected.patient_name)],
    [{ overdue: true }, (row) => row.plan_date < TODAY],
    [{ overdue: true, status: 0 }, (row) => row.plan_date < TODAY && row.status === 0],
    [{ overdue: true, status: 0, overdue_range: '7d' }, (row) => row.plan_date >= '2026-09-02' && row.plan_date < TODAY && row.status === 0],
    [{ overdue: true, status: 0, overdue_range: '30d' }, (row) => row.plan_date >= '2026-08-10' && row.plan_date < TODAY && row.status === 0]
  ]) {
    assert.deepEqual(ids(await api.all(P + 'medication-plan/index', { scope: 'all', ...query })), ids(plans.filter(predicate)))
  }
  assert.ok(plans.some((row) => row.status === 0 && row.plan_date < '2026-08-10'))
  assert.deepEqual(await api.all(P + 'medication-plan/index', { scope: 'all', patient_name: '不存在的虚构患者' }), [])
  const reactions = await api.all(P + 'adverse-reaction/index')
  for (const severity of [1, 2, 3]) {
    assert.deepEqual(ids(await api.all(P + 'adverse-reaction/index', { severity })), ids(reactions.filter((row) => row.severity === severity)))
  }
})

test('patient medication, reports and survey submissions follow a consistent enrollment timeline', async (t) => {
  const api = await start(t)
  await api.login()
  const patients = await api.all(P + 'patient/index')
  const plans = await api.all(P + 'medication-plan/index', { scope: 'all' })
  const reactions = await api.all(P + 'adverse-reaction/index')
  const surveys = new Map((await api.all(P + 'survey/index')).map((survey) => [survey.id, survey]))
  const dayValue = (date) => Date.parse(date.slice(0, 10) + 'T00:00:00Z')
  let medicationChecks = 0
  let submissionChecks = 0
  for (const patient of patients) {
    const medicines = await api.all(P + 'patient/medicine-list', { user_id: patient.id })
    const statuses = await api.ok(P + 'patient/survey-status', { query: { user_id: patient.id } })
    for (const medicine of medicines) {
      assert.ok(patient.enroll_date, `patient ${patient.id} has an enrollment date before receiving medicine`)
      assert.ok(medicine.created_at.slice(0, 10) >= patient.enroll_date, `medicine ${medicine.id} starts no earlier than enrollment`)
      assert.ok(medicine.created_at >= patient.created_at, `medicine ${medicine.id} is recorded after the patient exists`)
      for (const plan of plans.filter((row) => row.user_id === patient.id && row.medicine_id === medicine.id)) {
        assert.ok(plan.plan_date >= medicine.created_at.slice(0, 10), `plan ${plan.id} follows its medicine start date`)
        const expectedDay = (dayValue(plan.plan_date) - dayValue(medicine.created_at)) / 86400000 + 1
        assert.equal(plan.day_number, expectedDay, `plan ${plan.id} day_number measures days since this medicine began`)
        assert.ok(plan.created_at.slice(0, 10) >= patient.enroll_date, `plan ${plan.id} is not recorded before enrollment`)
        assert.ok(plan.created_at >= medicine.created_at, `plan ${plan.id} is created after its medicine is recorded`)
        const scheduledAt = `${plan.plan_date} ${plan.plan_time}:00`
        assert.ok(scheduledAt >= plan.created_at, `plan ${plan.id} is created before its scheduled dose`)
        if (plan.status === 1) assert.ok(plan.checked_at >= scheduledAt, `plan ${plan.id} is checked after its scheduled dose`)
        medicationChecks++
      }
    }
    for (const reaction of reactions.filter((row) => row.user_id === patient.id)) {
      assert.ok(patient.enroll_date)
      assert.ok(reaction.occurred_at.slice(0, 10) >= patient.enroll_date, `reaction ${reaction.id} occurs after enrollment`)
      assert.ok(reaction.occurred_at >= patient.created_at, `reaction ${reaction.id} does not precede its patient record`)
      assert.ok(reaction.created_at >= reaction.occurred_at, `reaction ${reaction.id} is reported after it occurs`)
      assert.ok(reaction.created_at.slice(0, 10) <= TODAY, `reaction ${reaction.id} is not reported in the future`)
    }
    for (const status of statuses.filter((row) => row.answered)) {
      const survey = surveys.get(status.template_id)
      assert.ok(survey)
      assert.ok(survey.createdAt <= status.submitted_at, `survey ${survey.id} exists when patient ${patient.id} submits it`)
      const expectedFillableDate = new Date(dayValue(patient.enroll_date) + survey.fillableDay * 86400000).toISOString().slice(0, 10)
      assert.equal(status.fillable_date, expectedFillableDate)
      assert.ok(status.submitted_at.slice(0, 10) >= expectedFillableDate, `patient ${patient.id} submits no earlier than the questionnaire opens`)
      assert.ok(status.submitted_at.slice(0, 10) <= TODAY)
      submissionChecks++
    }
  }
  assert.equal(medicationChecks, plans.length, 'all plans belong to a known patient medicine and are checked')
  assert.ok(medicationChecks > 0 && reactions.length > 0 && submissionChecks > 0, 'timeline assertions cover nonempty data')
})

test('dashboard metrics, trends, resources and todos can be recomputed from public detail APIs', async (t) => {
  const api = await start(t)
  await api.login()
  const patients = await api.all(P + 'patient/index')
  const plans = await api.all(P + 'medication-plan/index', { scope: 'all' })
  const reactions = await api.all(P + 'adverse-reaction/index')
  const resourceCounts = {}
  for (const [field, endpoint] of [['survey_total', 'survey'], ['article_total', 'health-article'], ['medicine_total', 'common-medicine']]) {
    resourceCounts[field] = (await api.all(P + endpoint + '/index')).length
  }
  for (const [range, startDate, days] of [['today', TODAY, 1], ['7d', '2026-09-02', 7], ['30d', '2026-08-10', 30]]) {
    const view = await api.ok(P + 'dashboard/overview', { query: { range } })
    assert.equal(view.date, TODAY)
    assert.equal(view.range, range)
    const expected = plans.filter((row) => row.plan_date >= startDate && row.plan_date <= TODAY)
    const adverse = reactions.filter((row) => row.occurred_at.slice(0, 10) >= startDate && row.occurred_at.slice(0, 10) <= TODAY)
    const archived = patients.filter((row) => row.is_archived === 1).length
    assert.deepEqual(view.metrics, {
      patient_total: patients.length, archived_total: archived, expected_total: expected.length,
      completed_total: expected.filter((row) => row.status === 1).length, new_adverse_total: adverse.length
    })
    assert.deepEqual(view.archive, { archived, unarchived: patients.length - archived })
    assert.deepEqual(view.resources, resourceCounts)
    assert.equal(view.todos.pending_review_total, adverse.length)
    assert.equal(view.todos.overdue_total, plans.filter((row) => row.status === 0 && row.plan_date < TODAY && (range === 'today' || row.plan_date >= startDate)).length)
    assert.deepEqual(view.adverse_severity, { mild: adverse.filter((row) => row.severity === 1).length, moderate: adverse.filter((row) => row.severity === 2).length, severe: adverse.filter((row) => row.severity === 3).length })
    assert.equal(view.trend.labels.length, days)
    assert.equal(sum(view.trend.expected), expected.length)
    assert.equal(sum(view.trend.completed), view.metrics.completed_total)
    for (let index = 0; index < days; index++) {
      const day = new Date(Date.parse(startDate + 'T00:00:00Z') + index * 86400000).toISOString().slice(0, 10)
      assert.equal(view.trend.labels[index], day.slice(5))
      assert.equal(view.trend.expected[index], expected.filter((row) => row.plan_date === day).length)
      assert.equal(view.trend.completed[index], expected.filter((row) => row.plan_date === day && row.status === 1).length)
    }
  }
})

test('Shanghai date rolls over independently from UTC calendar date', async (t) => {
  const api = await start(t, '2026-09-07T16:30:00.000Z')
  await api.login()
  const view = await api.ok(P + 'dashboard/overview', { query: { range: 'today' } })
  assert.equal(view.date, TODAY)
  const plans = await api.all(P + 'medication-plan/index', { scope: 'today' })
  assert.ok(plans.length)
  assert.ok(plans.every((row) => row.plan_date === TODAY))
})

test('historical dashboard overdue totals match as_of drilldowns for every range', async (t) => {
  const api = await start(t)
  await api.login()
  const historicalDate = '2026-09-03'
  const plans = await api.all(P + 'medication-plan/index', { scope: 'all' })
  for (const [range, firstDate] of [['today', null], ['7d', '2026-08-28'], ['30d', '2026-08-05']]) {
    const query = { scope: 'all', status: 0, overdue: true, ...(range === 'today' ? {} : { overdue_range: range }) }
    const view = await api.ok(P + 'dashboard/overview', { query: { range, date: historicalDate } })
    assert.equal(view.date, historicalDate)
    const expected = plans.filter((plan) => plan.status === 0 && plan.plan_date < historicalDate && (!firstDate || plan.plan_date >= firstDate))
    const drilldown = await api.all(P + 'medication-plan/index', { ...query, as_of: historicalDate })
    assert.equal(view.todos.overdue_total, expected.length, `${range} dashboard respects its selected historical date`)
    assert.equal(drilldown.length, view.todos.overdue_total, `${range} todo drilldown matches its dashboard count`)
    assert.deepEqual(ids(drilldown), ids(expected), `${range} drilldown includes exactly the historical overdue records`)
    assert.ok(drilldown.length > 0, `${range} is exercised with actual overdue records`)
    const current = await api.all(P + 'medication-plan/index', query)
    assert.notDeepEqual(ids(current), ids(drilldown), `${range} historical anchor changes the selected record set`)
    for (const as_of of ['not-a-date', '2026-02-30']) {
      assert.deepEqual(ids(await api.all(P + 'medication-plan/index', { ...query, as_of })), ids(current), `invalid as_of=${as_of} uses today's established behavior`)
    }
  }
})

test('administrator duplicate handling, profile, password updates and disabling enforce live sessions', async (t) => {
  const api = await start(t)
  const rootToken = await api.login()
  assert.ok(Array.isArray(await api.ok(P + 'admin/index')))
  const created = await api.ok(P + 'admin/save', { body: { username: 'test_operator', password: PASSWORD, phone: '10000000001', status: 1 } })
  assert.ok(created.id)
  assert.ok(!('password' in created))
  assert.equal((await api.json(P + 'admin/save', { body: { username: 'test_operator', password: PASSWORD, status: 1 } })).code, 422)
  assert.equal((await api.json(P + 'admin/update', { body: { ...created, username: 'admin' } })).code, 422)
  const operatorToken = await api.login('test_operator')
  await api.ok('/core/user/updateInfo', { body: { realname: '模拟测试员', phone: '10000000002', email: 'operator@example.test', gender: 1 } })
  const profile = await api.ok(P + 'system/user')
  assert.equal(profile.realname, '模拟测试员')
  assert.equal(profile.phone, '10000000002')
  assert.notEqual((await api.json('/core/user/modifyPassword', { body: { oldPassword: 'wrong', newPassword: 'Changed123456', confirmPassword: 'Changed123456' } })).code, 200)
  assert.notEqual((await api.json('/core/user/modifyPassword', { body: { oldPassword: PASSWORD, newPassword: 'Changed123456', confirmPassword: 'mismatch' } })).code, 200)
  await api.ok('/core/user/modifyPassword', { body: { oldPassword: PASSWORD, newPassword: 'Changed123456', confirmPassword: 'Changed123456' } })
  assert.equal((await api.json(P + 'system/user', { auth: operatorToken })).code, 401)
  const oldPasswordCaptcha = await api.ok(P + 'captcha', { auth: '' })
  assert.notEqual((await api.json(P + 'login', { auth: '', body: { username: 'test_operator', password: PASSWORD, code: '1234', uuid: oldPasswordCaptcha.uuid } })).code, 200)
  const changedToken = await api.login('test_operator', 'Changed123456')
  await api.ok(P + 'admin/update', { auth: rootToken, body: { ...created, status: 0 } })
  assert.equal((await api.json(P + 'system/user', { auth: changedToken })).code, 401)
  const captcha = await api.ok(P + 'captcha', { auth: '' })
  assert.notEqual((await api.json(P + 'login', { auth: '', body: { username: 'test_operator', password: 'Changed123456', code: '1234', uuid: captcha.uuid } })).code, 200)
  for (const endpoint of ['getLoginLogList', 'getOperationLogList']) {
    const page = await api.ok('/core/system/' + endpoint, { auth: rootToken, query: { page: 1, limit: 2 } })
    assert.ok(Array.isArray(page.data))
    assert.ok(page.total > 0)
    assert.equal(page.current_page, 1)
    assert.equal(typeof page.per_page, 'number')
  }
})

test('health article edits, medicine status and cache clear persist within the same service', async (t) => {
  const api = await start(t)
  await api.login()
  const payload = { title: '接口验收科普文章', summary: '虚构演示内容', content: '<p>只用于测试的中文正文</p>', sort: 11, status: 1 }
  const created = await api.ok(P + 'health-article/save', { body: payload })
  assert.ok(created.id)
  assert.equal((await api.ok(P + 'health-article/detail', { query: { id: created.id } })).content, payload.content)
  await api.ok(P + 'health-article/save', { body: { ...payload, id: created.id, title: '接口验收科普文章已编辑' } })
  await api.ok(P + 'health-article/toggle-status', { body: { id: created.id, status: 0 } })
  const matches = await api.all(P + 'health-article/index', { keyword: '接口验收科普文章已编辑', status: 0 })
  assert.deepEqual(ids(matches), [created.id])
  const medicine = (await api.all(P + 'common-medicine/index', { status: 1 }))[0]
  assert.ok(medicine)
  await api.ok(P + 'common-medicine/toggle-status', { body: { id: medicine.id, status: 0 } })
  assert.ok((await api.all(P + 'common-medicine/index', { status: 0, keyword: medicine.common_name })).some((row) => row.id === medicine.id))
  assert.ok(!(await api.all(P + 'common-medicine/index', { status: 1 })).some((row) => row.id === medicine.id))
  await api.ok('/core/system/clearAllCache')
  assert.equal((await api.ok(P + 'health-article/detail', { query: { id: created.id } })).status, 0)
  assert.equal((await api.json(P + 'health-article/detail', { query: { id: 99999999 } })).code, 404)
  assert.equal((await api.json(P + 'common-medicine/toggle-status', { body: { id: 99999999, status: 0 } })).code, 404)
})

test('survey nested structure, per-patient answers, deletion protection and XLSX participant counts', async (t) => {
  const api = await start(t)
  await api.login()
  const surveys = await api.all(P + 'survey/index')
  const answered = surveys.find((row) => row.answerCount > 0)
  const empty = surveys.find((row) => row.answerCount === 0)
  assert.ok(answered && empty)
  const detail = await api.ok(P + 'survey/detail', { query: { id: answered.id } })
  assert.equal(detail.questions.length, answered.questionCount)
  assert.deepEqual(new Set(detail.questions.map((row) => row.type)), new Set(['RADIO', 'CHECKBOX', 'TEXT']))
  const options = detail.questions.flatMap((row) => row.options)
  assert.ok(options.some((row) => row.isExclusive))
  assert.ok(options.some((row) => row.triggerInput && row.inputFields?.length))
  let answerRows = 0
  const participants = []
  for (const patient of await api.all(P + 'patient/index')) {
    const statuses = await api.ok(P + 'patient/survey-status', { query: { user_id: patient.id } })
    const status = statuses.find((row) => row.template_id === answered.id)
    if (!status?.answered) continue
    const response = await api.ok(P + 'patient/survey-answer-detail', { query: { user_id: patient.id, template_id: answered.id } })
    assert.equal(response.template.id, answered.id)
    assert.equal(response.submitted_at, status.submitted_at)
    assert.equal(response.questions.filter((row) => row.answered).length, status.answer_count)
    answerRows += status.answer_count
    participants.push({ patient, response })
  }
  assert.equal(answerRows, answered.answerCount, 'answerCount counts question answer rows, not unique participants')
  assert.ok(participants.length > 0)
  const response = await api.raw(P + 'survey/export', { query: { id: answered.id, current: 1, size: 1 } })
  assert.match(response.headers.get('content-type'), /application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/)
  const rows = workbookRows(Buffer.from(await response.arrayBuffer()))
  assert.deepEqual(rows[0].slice(0, 4), ['患者ID', '患者姓名', '手机号', '提交时间'])
  assert.equal(rows.length - 1, participants.length)
  assert.equal(rows[0].length, 4 + detail.questions.length)
  for (const { patient, response: answers } of participants) {
    const row = rows.find((values, index) => index > 0 && Number(values[0]) === patient.id)
    assert.ok(row)
    assert.equal(row[1], patient.name)
    assert.equal(row[2], patient.mobile)
    assert.equal(row[3], answers.submitted_at)
    for (let index = 0; index < detail.questions.length; index++) {
      const answer = answers.questions.find((question) => question.question_id === detail.questions[index].id)
      const exportSummary = answer.type === 'TEXT' ? answer.text_value : answer.selected_options.map((option) => {
        const fields = option.trigger_input ? option.input_fields.filter((field) => field.value).map((field) => `${field.field_label}：${field.value}`).join('；') : ''
        return option.label + (fields ? `（${fields}）` : '')
      }).join('、')
      assert.equal(row[index + 4] ?? '', exportSummary || '-')
    }
  }
  assert.equal((await api.json(P + 'survey/delete', { body: { id: answered.id } })).code, 422)
  await api.ok(P + 'survey/toggle-status', { body: { id: empty.id, status: 0 } })
  assert.equal((await api.ok(P + 'survey/detail', { query: { id: empty.id } })).status, 0)
  await api.ok(P + 'survey/delete', { body: { id: empty.id } })
  assert.equal((await api.json(P + 'survey/detail', { query: { id: empty.id } })).code, 404)
  const missing = await api.raw(P + 'survey/export', { query: { id: 99999999 } })
  assert.match(missing.headers.get('content-type'), /application\/json/)
  assert.equal((await missing.json()).code, 404)
})

test('adverse reaction XLSX uses all filtered records with original Chinese headers', async (t) => {
  const api = await start(t)
  await api.login()
  const expected = await api.all(P + 'adverse-reaction/index', { severity: 2 })
  assert.ok(expected.length > 1)
  const response = await api.raw(P + 'adverse-reaction/export', { query: { severity: 2, current: 1, size: 1 } })
  assert.match(response.headers.get('content-type'), /application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/)
  const rows = workbookRows(Buffer.from(await response.arrayBuffer()))
  assert.deepEqual(rows[0], ['ID', '患者姓名', '手机号', '发生时间', '主要症状', '症状描述', '严重程度', '处理建议', '状态', '上报时间'])
  assert.equal(rows.length - 1, expected.length)
  for (const reaction of expected) {
    const row = rows.find((values, index) => index > 0 && Number(values[0]) === reaction.id)
    assert.deepEqual(row, [String(reaction.id), reaction.patient_name, reaction.patient_mobile, reaction.occurred_at, reaction.symptom_summary, reaction.symptom_description, reaction.severity_text, reaction.advice_text, reaction.status_text, reaction.created_at])
  }
  const emptyResponse = await api.raw(P + 'adverse-reaction/export', { query: { patient_name: '不存在的虚构患者' } })
  assert.equal(workbookRows(Buffer.from(await emptyResponse.arrayBuffer())).length, 1)
})

test('multipart upload is byte accurate, visible in gallery, and restart resets resources, data and sessions', async (t) => {
  const api = await start(t)
  const token = await api.login()
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5ioAAAAASUVORK5CYII=', 'base64')
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: 'image/png' }), '接口验收.png')
  const uploaded = await api.ok(P + 'file/upload-file', { body: form })
  assert.match(uploaded.url, /^\/api\/mock-files\//)
  const filePath = uploaded.url.replace(/^\/api/, '')
  const image = await api.raw(filePath, { auth: '' })
  assert.equal(image.status, 200)
  assert.match(image.headers.get('content-type'), /^image\/png/)
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), bytes)
  const gallery = await api.ok('/core/system/getResourceList', { query: { page: 1, limit: 100 } })
  assert.ok(gallery.data.some((resource) => resource.url === uploaded.url))
  assert.equal(gallery.current_page, 1)
  assert.ok(Array.isArray(await api.ok('/core/system/getResourceCategory')))
  await api.ok('/core/user/updateInfo', { body: { avatar: uploaded.url } })
  assert.equal((await api.ok(P + 'system/user')).avatar, uploaded.url)
  const articlesBefore = await api.all(P + 'health-article/index')
  await api.ok(P + 'health-article/save', { body: { title: '重启必须清除', summary: '演示', content: '<p>演示</p>', sort: 0, status: 1 } })
  assert.equal((await api.all(P + 'health-article/index')).length, articlesBefore.length + 1)
  const restarted = await start(t)
  assert.equal((await restarted.json(P + 'system/user', { auth: token })).code, 401)
  assert.equal((await restarted.raw(filePath, { auth: '' })).status, 404)
  await restarted.login()
  assert.deepEqual(await restarted.all(P + 'health-article/index'), articlesBefore)
  const cleanGallery = await restarted.ok('/core/system/getResourceList', { query: { page: 1, limit: 100 } })
  assert.ok(!cleanGallery.data.some((resource) => resource.url === uploaded.url))
  const badForm = new FormData()
  badForm.append('other', 'missing file')
  assert.notEqual((await api.json(P + 'file/upload-file', { body: badForm })).code, 200)
})


test('research project basic fields, editable statuses and restart isolation', async (t) => {
  const api = await start(t)
  assert.equal((await api.json(P + 'project/catalog')).code, 401)
  await api.login()
  const initial = await api.all(P + 'project/index')
  const menu = (await api.ok(P+'system/menu')).find(m=>m.path==='/project')
  assert.ok(menu.children.some(c=>c.path==='groups' && c.meta.isHide))
  assert.ok(menu.children.some(c=>c.path==='group' && c.meta.isHide))
  const payload = { code:'TB-TEST-001', name:'项目验收', research_type:'open', start_date:TODAY, end_date:'2027-09-08', purpose:'研究目的', notes:'' }
  const created = await api.ok(P+'project/save',{body:payload})
  assert.equal(created.status,0)
  assert.equal(created.center,undefined)
  for (const invalid of [{code:'tb-test-001'},{name:''},{research_type:'other'},{end_date:'2026-02-30'},{end_date:'2026-09-07'},{status:1}]) {
    assert.notEqual((await api.json(P+'project/save',{body:{...payload,...invalid}})).code,200)
  }
  for (const type of ['single_blind','double_blind']) {
    assert.equal((await api.ok(P+'project/save',{body:{...payload,id:created.id,research_type:type}})).research_type,type)
  }
  const page = await api.ok(P+'project/index',{query:{current:2,size:1}})
  assert.equal(page.list.length,1)
  assert.equal(page.total,initial.length+1)
  assert.equal((await api.all(P+'project/index',{keyword:'tb-test',status:0}))[0].id,created.id)
  assert.equal((await api.all(P+'project/index',{keyword:'无此项目'})).length,0)
  for (const status of [2,1,0]) {
    await api.ok(P+'project/change-status',{body:{id:created.id,status,reason:'人工修正状态'}})
    await api.ok(P+'project/save',{body:{...payload,id:created.id,notes:'可继续维护'}})
  }
  assert.notEqual((await api.json(P+'project/change-status',{body:{id:created.id,status:1,reason:''}})).code,200)
  assert.notEqual((await api.json(P+'project/change-status',{body:{id:created.id,status:1,expected_status:2,reason:'过期提交'}})).code,200)
  const detail = await api.ok(P+'project/detail',{query:{id:created.id}})
  assert.ok(detail.history.some(h=>h.action==='变更状态'))
  assert.deepEqual(detail.groups,[])
  const restarted = await start(t); await restarted.login()
  assert.deepEqual(await restarted.all(P+'project/index'),initial)
})

test('group associations reuse shared sources, isolate snapshots, validate schedules and preserve patient data', async (t) => {
  const api = await start(t); await api.login()
  const patientPlans = await api.all(P+'medication-plan/index')
  const catalog = await api.ok(P+'project/catalog')
  const scheme = catalog.medication_schemes.find(s=>s.status===1)
  const survey = catalog.surveys.find(s=>s.status===1)
  const article = catalog.articles.find(s=>s.status===1)
  const contact = catalog.contacts.find(s=>s.status===1)
  const schedule = id => ({ id, anchor:'enrollment', date:'', offset_days:0, interval_days:7, deadline_days:3, reminders:{start:true,due:true,overdue:true} })
  const payload = {project_id:1,name:'A组',description:'验证关联',medication:{id:scheme.id,treatment_days:30,pickup_days:14,advance_days:3,quantities:scheme.drugs.map(d=>({drug_id:d.drug_id,quantity:30}))},surveys:[schedule(survey.id)],tasks:[schedule(catalog.task_templates[0].id)],article_ids:[article.id],contact_ids:[contact.id]}
  const created = await api.ok(P+'project/group-save',{body:payload})
  assert.equal(created.revision,1)
  assert.deepEqual(created.medication.snapshot.drugs,scheme.drugs)
  assert.deepEqual(created.surveys[0].snapshot.questions,survey.questions)
  const project = await api.ok(P+'project/detail',{query:{id:1}})
  assert.equal(project.groups[0].id,created.id)
  assert.ok(project.history[0].changes[0].after.medication)
  assert.notEqual((await api.json(P+'project/group-save',{body:payload})).code,200)
  await api.ok(P+'project/group-save',{body:{...payload,project_id:2}})
  await api.ok(P+'project/group-save',{body:{...payload,name:'B组'}})
  assert.equal((await api.json(P+'project/group-detail',{query:{project_id:2,id:created.id}})).code,404)
  assert.equal((await api.json(P+'project/group-save',{body:{...payload,id:created.id,project_id:2,revision:1}})).code,404)
  assert.notEqual((await api.json(P+'survey/delete',{body:{id:survey.id}})).code,200)
  for (const invalid of [
    {contact_ids:[999999]}, {article_ids:[999999]}, {surveys:[schedule(999999)]},
    {surveys:[schedule(survey.id),schedule(survey.id)]}, {contact_ids:[contact.id,contact.id]},
    {surveys:[{...schedule(survey.id),interval_days:-1}]},
    {tasks:[{...schedule(1),anchor:'date',date:'2026-02-30',interval_days:0}]},
    {tasks:[{...schedule(1),anchor:'date',date:TODAY}]},
    {medication:{...payload.medication,advance_days:15}},
    {medication:{...payload.medication,quantities:[]}},
    {medication:{...payload.medication,id:catalog.medication_schemes.find(s=>s.status===0).id}}
  ]) {
    assert.notEqual((await api.json(P+'project/group-save',{body:{...payload,...invalid,name:'非法配置'}})).code,200)
  }
  assert.equal((await api.ok(P+'project/detail',{query:{id:1}})).groups.length,2)
  await api.ok(P+'health-article/save',{body:{id:article.id,title:'来源已更新',summary:'更新后的介绍',content:'<p>更新</p>',status:1,sort:0}})
  await api.ok(P+'survey/toggle-status',{body:{id:survey.id,status:0}})
  const saved = await api.ok(P+'project/group-save',{body:{...payload,id:created.id,revision:1,name:'A组调整'}})
  assert.equal(saved.revision,2)
  assert.deepEqual(saved.articles[0].snapshot,created.articles[0].snapshot)
  assert.notEqual((await api.json(P+'project/group-save',{body:{...payload,name:'不能新用停用问卷'}})).code,200)
  assert.notEqual((await api.json(P+'project/group-save',{body:{...payload,id:created.id,revision:1}})).code,200)
  assert.deepEqual(await api.all(P+'medication-plan/index'),patientPlans)
  const draft = await api.ok(P+'project/group-save',{body:{project_id:1,name:'空配置草稿',description:'',medication:null,surveys:[],tasks:[],article_ids:[],contact_ids:[]}})
  assert.equal(draft.medication,null)
  await api.ok(P+'survey/toggle-status',{body:{id:2,status:1}})
  await api.ok(P+'project/group-save',{body:{...payload,name:'引用无答卷模板',surveys:[schedule(2)]}})
  const protectedSurvey = await api.json(P+'survey/delete',{body:{id:2}})
  assert.notEqual(protectedSurvey.code,200)
  assert.match(protectedSurvey.message,/研究分组引用/)
  const restarted = await start(t); await restarted.login()
  assert.deepEqual((await restarted.ok(P+'project/detail',{query:{id:1}})).groups,[])
})
