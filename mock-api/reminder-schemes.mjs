export function registerReminderSchemes({ core, db, assert, find, page, clean, timestamp, nextId }) {
  const integer = (value, label, min, max) => {
    assert(Number.isInteger(value) && value >= min && value <= max, `${label}应为${min}至${max}的整数`);
    return value;
  };
  const text = (value, label, max, required = false) => {
    const result = clean(value);
    assert(result.length <= max && (!required || result), `请填写有效的${label}`);
    return result;
  };
  const bool = (value, label) => {
    assert(typeof value === 'boolean', `${label}设置不完整`);
    return value;
  };
  const time = (value, label) => {
    const result = clean(value);
    assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(result), `请填写有效的${label}`);
    return result;
  };
  const snapshot = row => {
    const { history, ...data } = row;
    return structuredClone(data);
  };
  const log = (row, admin, before, reason) => {
    row.history ||= [];
    row.history.unshift({
      time: timestamp(),
      operator: admin.realname || admin.username,
      reason,
      before,
      after: snapshot(row)
    });
  };
  const normalize = body => {
    const medication_enabled = bool(body.medication_enabled, '用药提醒');
    const task_start_enabled = bool(body.task_start_enabled, '任务开始提醒');
    const task_due_enabled = bool(body.task_due_enabled, '任务到期提醒');
    const task_overdue_enabled = bool(body.task_overdue_enabled, '任务逾期提醒');
    const pickup_enabled = bool(body.pickup_enabled, '取药提醒');
    assert(
      medication_enabled || task_start_enabled || task_due_enabled || task_overdue_enabled || pickup_enabled,
      '请至少启用一个提醒场景'
    );
    return {
      medication_enabled,
      medication_advance_minutes: integer(body.medication_advance_minutes, '用药提前分钟数', 0, 180),
      task_start_enabled,
      task_due_enabled,
      task_overdue_enabled,
      task_remind_time: time(body.task_remind_time, '任务提醒时间'),
      pickup_enabled,
      pickup_advance_days: integer(body.pickup_advance_days, '取药提前天数', 0, 60),
      pickup_remind_time: time(body.pickup_remind_time, '取药提醒时间')
    };
  };

  core('GET', 'reminder-scheme/index', ({ query: q }) => {
    assert(q.status === undefined || q.status === '' || ['0', '1'].includes(q.status), '状态不合法');
    const keyword = clean(q.keyword);
    const rows = db.reminderSchemes.filter(row =>
      (!keyword || `${row.name} ${row.description}`.includes(keyword)) &&
      (q.status === undefined || q.status === '' || row.status === Number(q.status))
    );
    return page([...rows].sort((a, b) => b.id - a.id).map(snapshot), q);
  });

  core('GET', 'reminder-scheme/detail', ({ query: q }) => find(db.reminderSchemes, q.id, '提醒方案'));

  core('POST', 'reminder-scheme/save', ({ body: b, admin }) => {
    const old = b.id === undefined ? null : find(db.reminderSchemes, b.id, '提醒方案');
    if (old) assert(b.version === old.version, '方案已更新，请刷新后编辑');
    const name = text(b.name, '方案名称', 100, true);
    const description = text(b.description, '方案说明', 1000);
    const reason = text(b.reason, '修改原因', 300, Boolean(old));
    assert(!db.reminderSchemes.some(row => row !== old && row.name.toLowerCase() === name.toLowerCase()), '方案名称已存在');
    const rules = normalize(b);
    const row = old || {
      id: nextId(db.reminderSchemes),
      status: 1,
      revision: 0,
      created_at: timestamp(),
      history: []
    };
    const before = old ? snapshot(old) : null;
    Object.assign(row, {
      name,
      description,
      ...rules,
      revision: row.revision + 1,
      updated_at: timestamp()
    });
    row.version = `V${row.revision}`;
    log(row, admin, before, reason || '新增提醒方案');
    if (!old) db.reminderSchemes.push(row);
    return row;
  });

  core('POST', 'reminder-scheme/status', ({ body: b, admin }) => {
    const row = find(db.reminderSchemes, b.id, '提醒方案');
    assert(b.version === row.version, '方案已更新，请刷新后操作');
    integer(b.status, '状态', 0, 1);
    assert(b.status !== row.status, '状态未变化');
    const reason = text(b.reason, '变更原因', 300, true);
    const before = snapshot(row);
    row.status = b.status;
    row.revision += 1;
    row.version = `V${row.revision}`;
    row.updated_at = timestamp();
    log(row, admin, before, reason);
    return row;
  });
}
