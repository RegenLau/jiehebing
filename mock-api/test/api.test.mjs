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

test('patient mini-program login only accepts mobile numbers added by the admin', async (t) => {
  const api = await start(t)
  await api.login()
  const initial = await api.all(P + 'patient/index')
  assert.ok(initial.every((patient) => patient.created_via === 'admin' && patient.login_enabled))
  assert.ok(initial.every((patient) => patient.birth_date && !('hospital_name' in patient) && !('department_name' in patient) && !('consent_date' in patient)))

  const missing = await api.json('/app/login', { auth: '', body: { mobile: '13910009999' } })
  assert.equal(missing.code, 407)
  assert.match(missing.message, /后台患者档案/)
  assert.equal((await api.all(P + 'patient/index')).length, initial.length, 'failed login never creates a patient')

  const group = await api.ok(P + 'project/group-create', { body: { project_id: 1, name: '小程序登录验证组' } })
  const patient = await api.ok(P + 'patient/save', { body: {
    name: '新建登录患者', mobile: '13910009999', gender: 2, birth_date: '1990-06-18',
    project_id: 1, group_id: group.id, owner_id: 1, enroll_date: TODAY,
    offline_confirmed: true, consent_confirmed: true
  } })
  assert.equal(patient.login_enabled, true)
  assert.equal(patient.age, 36)
  assert.ok(!('hospital_name' in patient) && !('department_name' in patient) && !('consent_date' in patient))

  const login = await api.json('/app/login', { auth: '', body: { mobile: patient.mobile } })
  assert.equal(login.code, 0)
  assert.equal(login.data.user.id, patient.id)
  const token = login.data.token.access_token
  const archive = await api.json('/app/patient/archive-detail', { auth: token })
  assert.equal(archive.code, 0)
  assert.equal(archive.data.birth_date, patient.birth_date)
  assert.equal((await api.json('/app/logout', { auth: token, body: {} })).code, 0)
  assert.equal((await api.json('/app/patient/archive-detail', { auth: token })).code, 402)
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
  const payload = { code:'TB-TEST-001', name:'项目验收', start_date:TODAY, end_date:'2027-09-08', purpose:'研究目的' }
  const created = await api.ok(P+'project/save',{body:payload})
  assert.equal(created.status,0)
  assert.equal(created.center,undefined)
  assert.equal(created.research_type,undefined)
  assert.equal(created.notes,undefined)
  for (const invalid of [{code:'tb-test-001'},{name:''},{end_date:'2026-02-30'},{end_date:'2026-09-07'},{status:1}]) {
    assert.notEqual((await api.json(P+'project/save',{body:{...payload,...invalid}})).code,200)
  }
  const legacy = await api.ok(P+'project/detail',{query:{id:1}})
  const editedLegacy = await api.ok(P+'project/save',{body:{id:legacy.id,code:legacy.code,name:legacy.name,start_date:legacy.start_date,end_date:legacy.end_date,purpose:'更新研究目的',research_type:'double_blind',notes:'不应覆盖'}})
  assert.equal(editedLegacy.research_type,legacy.research_type)
  assert.equal(editedLegacy.notes,legacy.notes)
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


test('basic group creation is independent from configuration and enforces project names', async t => {
  const api=await start(t)
  assert.equal((await api.json(P+'project/group-create',{body:{project_id:1,name:'A'}})).code,401)
  await api.login()
  const seeded=(await api.ok(P+'project/detail',{query:{id:1}})).groups
  assert.equal(seeded.length,2)
  for(const body of [{project_id:1,name:''},{project_id:999,name:'A'},{project_id:1,name:'A',medication:{id:1}}]) assert.notEqual((await api.json(P+'project/group-create',{body})).code,200)
  const a=await api.ok(P+'project/group-create',{body:{project_id:1,name:'A'}})
  assert.equal(a.description,'');assert.equal(a.medication,null)
  assert.deepEqual(a.surveys,[]);assert.deepEqual(a.tasks,[]);assert.deepEqual(a.participant_ids,[])
  assert.equal(a.articles,undefined);assert.equal(a.contact_ids,undefined)
  assert.notEqual((await api.json(P+'project/group-create',{body:{project_id:1,name:'a'}})).code,200)
  await api.ok(P+'project/group-create',{body:{project_id:2,name:'A'}})
  assert.equal((await api.json(P+'project/group-detail',{query:{project_id:2,id:a.id}})).code,404)
  const restarted=await start(t);await restarted.login();assert.deepEqual((await restarted.ok(P+'project/detail',{query:{id:1}})).groups,seeded)
})

test('group basic edit preserves configuration and returns current enrolled patient data', async t => {
  const api=await start(t);await api.login()
  const patients=await api.all(P+'patient/index')
  const projects=await api.all(P+'project/index')
  const groups=(await Promise.all(projects.map(project=>api.ok(P+'project/detail',{query:{id:project.id}})))).flatMap(project=>project.groups)
  const a=groups.find(group=>group.participant_ids.length)
  const otherProject=projects.find(project=>project.id!==a.project_id)
  await api.ok(P+'project/group-create',{body:{project_id:a.project_id,name:'基础编辑B组'}})
  const configured=await api.ok(P+'project/group-detail',{query:{project_id:a.project_id,id:a.id}})
  const edited=await api.ok(P+'project/group-basic-save',{body:{id:a.id,project_id:a.project_id,revision:configured.revision,name:'基础编辑A组（新）',description:'只修改基础信息'}})
  assert.equal(edited.revision,configured.revision+1)
  assert.equal(edited.name,'基础编辑A组（新）');assert.equal(edited.description,'只修改基础信息')
  assert.deepEqual(edited.medication,configured.medication);assert.deepEqual(edited.surveys,configured.surveys);assert.deepEqual(edited.tasks,configured.tasks);assert.deepEqual(edited.participant_ids,configured.participant_ids)
  const patient=patients.find(p=>p.id===configured.participant_ids[0])
  assert.deepEqual(edited.participants[0],{id:patient.id,patient_code:patient.patient_code,name:patient.name,mobile:patient.mobile,gender_text:patient.gender_text,birth_date:patient.birth_date,enroll_date:patient.enroll_date,study_state:patient.study_state})
  assert.deepEqual(await api.ok(P+'project/group-detail',{query:{project_id:a.project_id,id:a.id}}),edited)
  const unchanged=await api.ok(P+'project/group-basic-save',{body:{id:a.id,project_id:a.project_id,revision:edited.revision,name:edited.name,description:edited.description}})
  assert.equal(unchanged.revision,edited.revision)
  for(const body of [
    {id:a.id,project_id:a.project_id,revision:configured.revision,name:'过期编辑',description:''},
    {id:a.id,project_id:a.project_id,revision:edited.revision,name:'基础编辑B组',description:''},
    {id:a.id,project_id:a.project_id,revision:edited.revision,name:'',description:''},
    {id:a.id,project_id:a.project_id,revision:edited.revision,name:'非法字段',description:'',participant_ids:[]}
  ]) assert.notEqual((await api.json(P+'project/group-basic-save',{body})).code,200)
  assert.equal((await api.json(P+'project/group-basic-save',{body:{id:a.id,project_id:otherProject.id,revision:edited.revision,name:'跨项目',description:''}})).code,404)
})

test('seed research groups cover every patient exactly once',async t=>{
  const api=await start(t);await api.login()
  const patients=await api.all(P+'patient/index')
  const projects=await api.all(P+'project/index')
  const groups=(await Promise.all(projects.map(project=>api.ok(P+'project/detail',{query:{id:project.id}})))).flatMap(project=>project.groups)
  assert.equal(groups.length,6)
  assert.ok(projects.every(project=>project.group_count===2))
  assert.ok(groups.every(group=>group.medication&&group.surveys.length&&group.tasks.length))
  const memberIds=groups.flatMap(group=>group.participant_ids)
  assert.equal(memberIds.length,patients.length)
  assert.equal(new Set(memberIds).size,patients.length)
  assert.deepEqual([...memberIds].sort((a,b)=>a-b),patients.map(patient=>patient.id).sort((a,b)=>a-b))
  for(const patient of patients){
    const group=groups.find(item=>item.id===patient.group_id)
    assert.ok(group)
    assert.equal(group.project_id,patient.project_id)
    assert.equal(group.name,patient.group_name)
    assert.ok(group.participants.some(item=>item.id===patient.id&&item.mobile===patient.mobile))
  }
})

test('saved group configuration validates sources and members without changing patient execution',async t=>{
  const api=await start(t);await api.login()
  const plans=await api.all(P+'medication-plan/index')
  const patients=await api.all(P+'patient/index')
  const initialProjectPatientCount=(await api.all(P+'project/index')).find(p=>p.id===1).patient_count
  const catalog=await api.ok(P+'project/catalog')
  assert.equal(catalog.articles,undefined);assert.equal(catalog.contacts,undefined)
  const scheme=catalog.medication_schemes.find(s=>s.status===1),survey=catalog.surveys.find(s=>s.status===1)
  const create=(project_id,name)=>api.ok(P+'project/group-create',{body:{project_id,name}})
  const a=await create(1,'A'),b=await create(1,'B'),other=await create(2,'A')
  const schedule=id=>({id,anchor:'enrollment',date:'',offset_days:0,interval_days:7,deadline_days:3,reminders:{start:true,due:true,overdue:true}})
  const config={...a,medication:{id:scheme.id,treatment_days:30,pickup_days:14,advance_days:3,quantities:scheme.drugs.map(d=>({drug_id:d.drug_id,quantity:30}))},surveys:[schedule(survey.id)],tasks:[schedule(1)],participant_ids:[1,2]}
  const saved=await api.ok(P+'project/group-save',{body:config})
  assert.equal(saved.revision,2);assert.deepEqual(saved.participant_ids,[1,2]);assert.equal(saved.participants[0].name,patients.find(p=>p.id===1).name)
  assert.equal((await api.all(P+'project/index')).find(p=>p.id===1).patient_count,initialProjectPatientCount+2)
  assert.deepEqual(saved.medication.snapshot.drugs,scheme.drugs)
  const people=await api.ok(P+'project/participants',{query:{project_id:1}})
  assert.equal(people.find(p=>p.id===1).group_id,a.id)
  assert.notEqual((await api.json(P+'project/group-save',{body:{...b,participant_ids:[1]}})).code,200)
  await api.ok(P+'project/group-save',{body:{...other,participant_ids:[1]}})
  for(const invalid of [
    {participant_ids:[999999]}, {participant_ids:[1,1]}, {participant_ids:[1.2]},
    {surveys:[schedule(9999)]},{surveys:[schedule(survey.id),schedule(survey.id)]},
    {surveys:[{...schedule(survey.id),interval_days:-1}]},
    {tasks:[{...schedule(1),anchor:'date',date:'2026-02-30',interval_days:0}]},
    {tasks:[{...schedule(1),anchor:'date',date:TODAY}]},
    {medication:{...config.medication,advance_days:15}},{medication:{...config.medication,quantities:[]}},
    {medication:{...config.medication,id:catalog.medication_schemes.find(s=>s.status===0).id}},
    {article_ids:[1]},{contact_ids:[1]}
  ]) assert.notEqual((await api.json(P+'project/group-save',{body:{...saved,...invalid}})).code,200)
  assert.deepEqual(await api.ok(P+'project/group-detail',{query:{project_id:1,id:a.id}}),saved)
  assert.equal((await api.json(P+'project/group-save',{body:{...saved,project_id:2}})).code,404)
  assert.notEqual((await api.json(P+'project/group-save',{body:config})).code,200)
  await api.ok(P+'survey/toggle-status',{body:{id:survey.id,status:0}})
  const updated=await api.ok(P+'project/group-save',{body:{...saved,description:'保留原模板内容',participant_ids:[2]}})
  assert.deepEqual(updated.surveys[0].snapshot,saved.surveys[0].snapshot)
  assert.notEqual((await api.json(P+'project/group-save',{body:{...b,surveys:[schedule(survey.id)]}})).code,200)
  await api.ok(P+'project/group-save',{body:{...b,participant_ids:[1]}})
  const choices=await api.ok(P+'project/participants',{query:{project_id:1}})
  assert.equal(choices.find(p=>p.id===1).group_id,b.id)
  await api.ok(P+'survey/toggle-status',{body:{id:2,status:1}})
  await api.ok(P+'project/group-save',{body:{...updated,surveys:[schedule(2)]}})
  assert.match((await api.json(P+'survey/delete',{body:{id:2}})).message,/研究分组引用/)
  assert.deepEqual(await api.all(P+'medication-plan/index'),plans)
  assert.deepEqual(await api.all(P+'patient/index'),patients)
})

test('medication schemes maintain versions, validate drugs, and preserve group snapshots', async t => {
  const api=await start(t);await api.login();
  const data=await api.ok(P+'medication-scheme/detail',{query:{id:1}});
  const body={...data,id:undefined,name:'通用方案新增测试',treatment_days:60,pickup_days:20,advance_days:5,drugs:data.drugs.map(d=>({...d,quantity:40}))};
  const row=await api.ok(P+'medication-scheme/save',{body});
  assert.equal(row.treatment_days,60);assert.equal(row.history.length,1);
  assert.notEqual((await api.json(P+'medication-scheme/save',{body})).code,200);
  for(const change of [{drugs:[]},{advance_days:21},{drugs:[body.drugs[0],body.drugs[0]]},{drugs:[{...body.drugs[0],times:'25:00'}]},{drugs:[{...body.drugs[0],dose:'0'}]}])assert.notEqual((await api.json(P+'medication-scheme/save',{body:{...body,name:'无效方案',...change}})).code,200);
  const group=await api.ok(P+'project/group-create',{body:{project_id:1,name:'方案隔离组'}});
  const configured=await api.ok(P+'project/group-save',{body:{...group,medication:{id:row.id,treatment_days:60,pickup_days:20,advance_days:5,quantities:row.drugs.map(d=>({drug_id:d.drug_id,quantity:40}))}}});
  const changed=await api.ok(P+'medication-scheme/save',{body:{...row,name:'新版本方案',reason:'更新名称'}});
  assert.equal(changed.history.length,2);assert.notEqual(changed.version,row.version);
  assert.notEqual((await api.json(P+'medication-scheme/save',{body:{...row,reason:'旧版本'}})).code,200);
  const after=await api.ok(P+'project/group-detail',{query:{project_id:1,id:group.id}});
  assert.deepEqual(after.medication,configured.medication);
  const disabled=await api.ok(P+'medication-scheme/status',{body:{id:row.id,version:changed.version,status:0,reason:'不再新关联'}});
  assert.equal(disabled.status,0);
  const catalog=await api.ok(P+'project/catalog');assert.equal(catalog.medication_schemes.find(s=>s.id===row.id).status,0);
});

test('task templates support maintenance, filters, revision checks and isolated references', async t=>{
 const api=await start(t);await api.login();
 const body={name:'复查模板测试',type:'检查',description:'模拟检查',requirements:'上传原图'};
 const row=await api.ok(P+'task-template/save',{body});assert.equal(row.history.length,1);
 assert.notEqual((await api.json(P+'task-template/save',{body})).code,200);
 assert.notEqual((await api.json(P+'task-template/save',{body:{...body,name:'错误类型',type:'无效'}})).code,200);
 const g=await api.ok(P+'project/group-create',{body:{project_id:1,name:'模板测试组'}});
 const configured=await api.ok(P+'project/group-save',{body:{...g,tasks:[{id:row.id,anchor:'enrollment',date:'',offset_days:1,interval_days:7,deadline_days:2,reminders:{start:true,due:true,overdue:false}}]}});
 const changed=await api.ok(P+'task-template/save',{body:{...row,requirements:'补充检查日期',reason:'完善提交要求'}});assert.notEqual(changed.version,row.version);
 assert.notEqual((await api.json(P+'task-template/save',{body:{...row,reason:'旧版本'}})).code,200);
 const after=await api.ok(P+'project/group-detail',{query:{project_id:1,id:g.id}});assert.deepEqual(after.tasks,configured.tasks);
 const disabled=await api.ok(P+'task-template/status',{body:{id:row.id,version:changed.version,status:0,reason:'停止新关联'}});assert.equal(disabled.status,0);
 const filtered=await api.ok(P+'task-template/index',{query:{type:'检查',status:0,keyword:'复查模板测试'}});assert.equal(filtered.total,1);
});

test('editing survey wording preserves historical answer text and exported headers',async t=>{
 const api=await start(t);await api.login();
 const original=await api.ok(P+'patient/survey-answer-detail',{query:{user_id:5,template_id:1}});
 const form=await api.ok(P+'survey/detail',{query:{id:1}});
 const edited=structuredClone(form);edited.name='新版问卷';edited.questions[0].title='新版题干';edited.questions[0].options[0].label='新版选项';
 await api.ok(P+'survey/save',{body:edited});
 const after=await api.ok(P+'patient/survey-answer-detail',{query:{user_id:5,template_id:1}});assert.deepEqual(after,original);
 const current=await api.ok(P+'survey/detail',{query:{id:1}});assert.equal(current.questions[0].title,'新版题干');assert.equal(current.history.length,1);
 assert.notEqual((await api.json(P+'survey/save',{body:edited})).code,200);
});

test('patient registration, treatment and dispensing preserve independent records',async t=>{
 const api=await start(t);await api.login();
 const g=await api.ok(P+'project/group-create',{body:{project_id:1,name:'患者入组测试'}});const catalog=await api.ok(P+'project/catalog');const source=catalog.medication_schemes[0];
 await api.ok(P+'project/group-save',{body:{...g,medication:{id:source.id,treatment_days:30,pickup_days:30,advance_days:3,quantities:source.drugs.map(d=>({drug_id:d.drug_id,quantity:30}))}}});
 const body={name:'测试患者',mobile:'13900000999',gender:1,birth_date:'1986-03-12',project_id:1,group_id:g.id,owner_id:1,enroll_date:TODAY,offline_confirmed:true,consent_confirmed:true};
 const p=await api.ok(P+'patient/save',{body});assert.equal(p.study_state,'待启用');
 assert.equal(p.birth_date,body.birth_date);assert.equal(p.age,40);assert.equal(p.login_enabled,true);
 assert.ok(!('hospital_name' in p)&&!('department_name' in p)&&!('consent_date' in p));
 assert.notEqual((await api.json(P+'patient/save',{body})).code,200);
 assert.notEqual((await api.json(P+'patient/save',{body:{...body,mobile:'13900000998',birth_date:''}})).code,200);
 assert.notEqual((await api.json(P+'patient/save',{body:{...body,mobile:'13900000998',birth_date:'2027-01-01'}})).code,200);
 assert.notEqual((await api.json(P+'patient/state',{body:{user_id:p.id,state:'治疗中',effective_date:TODAY,reason:'未确认方案'}})).code,200);
 const treatment=await api.ok(P+'patient/treatment',{body:{user_id:p.id,start_date:TODAY,treatment_days:30,reason:'医生确认',drugs:source.drugs}});assert.equal(treatment.source_group_id,g.id);
 await api.ok(P+'patient/state',{body:{user_id:p.id,state:'治疗中',effective_date:TODAY,reason:'确认启用'}});
 const disp=await api.ok(P+'patient/dispense',{body:{user_id:p.id,issued_date:TODAY,reason:'实际发药',items:treatment.drugs.map(d=>({drug_id:d.drug_id,quantity:30}))}});assert.equal(disp.items.length,source.drugs.length);
 const before=await api.ok(P+'patient/management',{query:{user_id:p.id}});
 assert.notEqual((await api.json(P+'patient/dispense',{body:{user_id:p.id,issued_date:TODAY,reason:'错误药品',items:[{drug_id:99999,quantity:1}]}})).code,200);
 const after=await api.ok(P+'patient/management',{query:{user_id:p.id}});assert.deepEqual(after,before);assert.equal(after.dispensings.length,1);
 const group=await api.ok(P+'project/group-detail',{query:{project_id:1,id:g.id}});assert.ok(group.participant_ids.includes(p.id));
 const filtered=await api.ok(P+'patient/index',{query:{keyword:body.mobile}});assert.equal(filtered.total,1);
});

test('generated execution follows group dates and retains safety tasks when medication pauses',async t=>{
 const api=await start(t);await api.login();const g=await api.ok(P+'project/group-create',{body:{project_id:1,name:'任务生成测试'}});const source=(await api.ok(P+'project/catalog')).medication_schemes[0];
 await api.ok(P+'project/group-save',{body:{...g,medication:{id:source.id,treatment_days:10,pickup_days:10,advance_days:2,quantities:source.drugs.map(d=>({drug_id:d.drug_id,quantity:10}))},tasks:[{id:1,anchor:'enrollment',offset_days:1,interval_days:7,deadline_days:2,date:'',reminders:{start:true,due:true,overdue:true}}]}});
 const p=await api.ok(P+'patient/save',{body:{name:'任务模拟患者',mobile:'13900000888',gender:2,birth_date:'1991-08-20',project_id:1,group_id:g.id,owner_id:1,enroll_date:TODAY,offline_confirmed:true,consent_confirmed:true}});
 const body={user_id:p.id,start_date:TODAY,treatment_days:10,reason:'方案确认',drugs:source.drugs};await api.ok(P+'patient/treatment',{body});
 const plans=await api.all(P+'medication-plan/index',{scope:'all',user_id:p.id});assert.equal(plans.length,20);
 const tasks=await api.ok(P+'followup/index',{query:{user_id:p.id}});assert.equal(tasks.total,2);assert.equal(tasks.list[1].date,'2026-09-09');assert.equal(tasks.list[1].due_date,'2026-09-10');
 await api.ok(P+'patient/treatment',{body});assert.equal((await api.ok(P+'followup/index',{query:{user_id:p.id}})).total,2);
 await api.ok(P+'patient/state',{body:{user_id:p.id,state:'暂停用药',effective_date:TODAY,reason:'医生暂停'}});
 assert.equal((await api.ok(P+'followup/index',{query:{user_id:p.id}})).list.filter(r=>r.status==='待完成').length,2);
 await api.ok(P+'followup/update',{body:{id:tasks.list[0].id,action:'contact',reason:'已联系患者'}});assert.equal((await api.ok(P+'followup/detail',{query:{id:tasks.list[0].id}})).status,'待完成');
 assert.notEqual((await api.json(P+'followup/update',{body:{id:tasks.list[0].id,action:'complete',reason:'不能绕过报告'}})).code,200);
});

test('report supplementation preserves originals and completes only its matching task',async t=>{
 const api=await start(t);await api.login();const task=await api.ok(P+'followup/create',{body:{user_id:1,name:'检查任务',type:'检查',date:TODAY,due_date:TODAY,description:'提交报告'}});
 const file=new FormData();file.append('file',new Blob([Buffer.from('89504e470d0a1a0a','hex')],{type:'image/png'}),'report.png');const uploaded=await api.ok(P+'file/upload-file',{body:file});
 const report=await api.ok(P+'report/create',{body:{user_id:1,task_id:task.id,type:'血常规',exam_date:TODAY,files:[uploaded.url]}});
 assert.equal((await api.ok(P+'followup/detail',{query:{id:task.id}})).status,'已提交');
 assert.notEqual((await api.json(P+'report/create',{body:{user_id:2,task_id:task.id,type:'检查',exam_date:TODAY,files:[uploaded.url]}})).code,200);
 await api.ok(P+'report/review',{body:{id:report.id,status:'需补充',reason:'图片不清晰',metrics:[]}});
 assert.equal((await api.ok(P+'followup/detail',{query:{id:task.id}})).status,'需补充');
 await api.ok(P+'report/supplement',{body:{id:report.id,note:'补传清晰图片',files:[uploaded.url]}});
 await api.ok(P+'report/review',{body:{id:report.id,status:'已核对',reason:'已核对原图',metrics:[{name:'模拟指标',value:'10',unit:'演示单位',reference:'示例'}]}});
 const after=await api.ok(P+'report/detail',{query:{id:report.id}});assert.equal(after.versions.length,2);assert.equal(after.history.length,2);assert.equal((await api.ok(P+'followup/detail',{query:{id:task.id}})).status,'已完成');
 assert.notEqual((await api.json(P+'report/review',{body:{id:report.id,status:'已核对',reason:'重复审核',metrics:[]}})).code,200);
});

test('adverse assessment separates severity from seriousness and records manual contacts',async t=>{
 const api=await start(t);await api.login();const original=await api.ok(P+'adverse-reaction/assessment',{query:{id:1}});
 const body={id:1,revision:0,processing_status:'处理中',owner_id:1,category:'AE',event_name:'模拟事件',assessed_severity:1,serious:true,special_interest:true,relatedness:'待研究者核实',measures:'人工联系并核查',outcome:'',ended_at:'',reason:'记录评估'};
 const result=await api.ok(P+'adverse-reaction/assess',{body});assert.equal(result.assessment.serious,true);assert.equal(result.assessment.special_interest,true);assert.equal(result.severity,original.severity);
 assert.notEqual((await api.json(P+'adverse-reaction/assess',{body})).code,200);
 assert.notEqual((await api.json(P+'adverse-reaction/assess',{body:{...body,revision:1,processing_status:'已处理'}})).code,200);
 await api.ok(P+'adverse-reaction/contact',{body:{id:1,channel:'电话',result:'无人接听',next_action:'稍后再次联系'}});const after=await api.ok(P+'adverse-reaction/assessment',{query:{id:1}});assert.equal(after.contacts[0].result,'无人接听');assert.equal(after.processing_status,'处理中');
});

test('feedback preserves per-day raw records and rejects conflicting symptom selections',async t=>{
 const api=await start(t);await api.login();const body={user_id:20,date:TODAY,no_discomfort:false,symptoms:[{name:'咳嗽',change:'消失'}],note:'后台转录患者反馈',audio_url:''};const row=await api.ok(P+'feedback/record',{body});assert.equal(row.source,'后台代录');assert.equal(row.symptoms[0].change,'消失');assert.notEqual((await api.json(P+'feedback/record',{body})).code,200);assert.notEqual((await api.json(P+'feedback/record',{body:{...body,user_id:21,no_discomfort:true}})).code,200);const filtered=await api.ok(P+'feedback/index',{query:{user_id:20,date:TODAY}});assert.equal(filtered.total,1);
});

test('manual medication result is explicit and dashboard research metrics derive from rows',async t=>{
 const api=await start(t);await api.login();const plans=await api.ok(P+'medication-plan/index',{query:{scope:'today',status:0}});const plan=plans.list[0];
 await api.ok(P+'medication-plan/record',{body:{id:plan.id,status:2,reason:'电话核实患者明确未服'}});const filtered=await api.ok(P+'medication-plan/index',{query:{scope:'today',status:2}});assert.ok(filtered.list.some(r=>r.id===plan.id));
 const before=await api.ok(P+'dashboard/research');const task=await api.ok(P+'followup/create',{body:{user_id:1,name:'过期复诊',type:'复诊',date:'2026-09-01',due_date:'2026-09-02',description:'核实复诊'}});const middle=await api.ok(P+'dashboard/research');assert.equal(middle.tasks_overdue,before.tasks_overdue+1);await api.ok(P+'followup/update',{body:{id:task.id,action:'complete',reason:'人工核实已复诊'}});const after=await api.ok(P+'dashboard/research');assert.equal(after.tasks_overdue,before.tasks_overdue);assert.equal(after.tasks_completed,before.tasks_completed+1);
});

test('new research exports are real XLSX and cover the filtered complete dataset',async t=>{
 const api=await start(t);await api.login();for(let n=0;n<12;n++)await api.ok(P+'followup/create',{body:{user_id:1,name:`导出验证任务${n}`,type:'复诊',date:TODAY,due_date:TODAY,description:'模拟要求'}});
 const response=await api.raw(P+'research/export',{query:{kind:'tasks',keyword:'导出验证',size:1}});assert.match(response.headers.get('content-type'),/spreadsheetml/);const rows=workbookRows(Buffer.from(await response.arrayBuffer()));assert.equal(rows.length,13);assert.ok(rows.flat().some(v=>v.includes('导出验证任务')));assert.notEqual((await api.json(P+'research/export',{query:{kind:'invalid'}})).code,200);
});

test('daily feedback stores speech-converted text without audio fields or export columns',async t=>{
 const api=await start(t);await api.login();const note='语音转文字：今天咳嗽比昨天减轻，吃饭正常。';const body={user_id:24,date:TODAY,no_discomfort:false,symptoms:[{name:'咳嗽',change:'减轻'}],note};const saved=await api.ok(P+'feedback/record',{body});assert.equal(saved.note,note);assert.equal('audio_url' in saved,false);
 const rows=workbookRows(Buffer.from(await(await api.raw(P+'research/export',{query:{kind:'feedback',user_id:24}})).arrayBuffer()));assert.ok(rows.flat().includes(note));assert.ok(!rows[0].some(v=>v.includes('语音地址')));
 assert.notEqual((await api.json(P+'feedback/record',{body:{...body,user_id:23,audio_url:'/api/mock-files/test'}})).code,200);
});
