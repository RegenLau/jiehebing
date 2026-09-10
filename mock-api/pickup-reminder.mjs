export const DEFAULT_PICKUP_REQUIREMENTS =
  "请在预计药量不足前联系医院确认取药安排，实际发药由医务人员登记。";
export const DEFAULT_PICKUP_REMIND_TIME = "09:00";

export function calculatePatientStock({
  db,
  patient,
  treatment,
  today,
  shiftDate,
}) {
  if (!treatment) return [];
  const currentDate = today();
  const group = db.projectGroups.find((row) => row.id === patient.group_id);
  const advanceDays = Number(
    group?.medication?.advance_days ??
      treatment.source_scheme?.advance_days ??
      0,
  );

  return treatment.drugs.map((drug) => {
    const adjustments = (db.stockAdjustments || [])
      .filter(
        (row) => row.user_id === patient.id && row.drug_id === drug.drug_id,
      )
      .sort(
        (left, right) =>
          right.date.localeCompare(left.date) || right.id - left.id,
      );
    const adjustment = adjustments[0];
    const dispensings = (db.dispensings || []).filter(
      (row) =>
        row.user_id === patient.id &&
        (!adjustment || row.issued_date > adjustment.date) &&
        row.items.some((item) => item.drug_id === drug.drug_id),
    );
    const issued = dispensings.reduce(
      (total, row) =>
        total +
        row.items
          .filter((item) => item.drug_id === drug.drug_id)
          .reduce((sum, item) => sum + Number(item.quantity), 0),
      0,
    );
    const firstDispenseDate = dispensings
      .map((row) => row.issued_date)
      .sort()[0];
    const consumptionStart =
      adjustment?.date || firstDispenseDate || treatment.start_date;
    const used = db.plans
      .filter(
        (row) =>
          row.user_id === patient.id &&
          row.common_medicine_id === drug.drug_id &&
          row.plan_date < currentDate &&
          (!consumptionStart ||
            (adjustment
              ? row.plan_date > consumptionStart
              : row.plan_date >= consumptionStart)) &&
          ![2, 3].includes(row.status),
      )
      .reduce((total, row) => total + Number(row.dosage_value), 0);
    const hasActualBaseline = Boolean(adjustment || dispensings.length);
    const legacyQuantity = treatment.legacy
      ? Number(
          group?.medication?.quantities?.find(
            (item) => item.drug_id === drug.drug_id,
          )?.quantity || 0,
        )
      : 0;
    const estimated = Math.max(
      0,
      Number(adjustment?.quantity ?? (hasActualBaseline ? 0 : legacyQuantity)) +
        issued -
        used,
    );
    const times = Array.isArray(drug.times) ? drug.times : [];
    const dailyQuantity = Number(drug.dose) * times.length;
    const calculationReady = hasActualBaseline && dailyQuantity > 0;
    const days = calculationReady ? Math.floor(estimated / dailyQuantity) : 0;
    const expectedShortageDate = calculationReady
      ? shiftDate(currentDate, days)
      : "";
    const reminderDate = calculationReady
      ? shiftDate(expectedShortageDate, -advanceDays)
      : "";

    return {
      drug_id: drug.drug_id,
      name: drug.name,
      unit: drug.unit,
      estimated,
      daily_quantity: dailyQuantity,
      days,
      advance_days: advanceDays,
      expected_shortage_date: expectedShortageDate,
      reminder_date: reminderDate,
      calculation_ready: calculationReady,
      needs_pickup: calculationReady && reminderDate <= currentDate,
      adjustments,
      method: hasActualBaseline
        ? "按最近一次盘点或当前个体方案的实际发药量，扣除截至昨日的计划用量估算；明确未服、暂停或取消不扣减，不能代替实际盘点"
        : "尚未登记当前个体方案的实际发药或余药盘点，暂不计算取药提醒",
    };
  });
}

export function buildPickupReminderTask({
  db,
  patient,
  treatment,
  today,
  shiftDate,
  visibleThrough,
}) {
  if (!treatment) return null;
  const group = db.projectGroups.find((row) => row.id === patient.group_id);
  const reminder = group?.reminder?.snapshot;
  if (!group?.medication) return null;

  const stock = calculatePatientStock({
    db,
    patient,
    treatment,
    today,
    shiftDate,
  });
  if (!stock.length || stock.some((row) => !row.calculation_ready)) return null;
  const trigger = [...stock].sort(
    (left, right) =>
      left.expected_shortage_date.localeCompare(right.expected_shortage_date) ||
      left.drug_id - right.drug_id,
  )[0];
  if (!trigger || trigger.reminder_date > visibleThrough) return null;

  return {
    id: `pickup-${treatment.id}-${trigger.drug_id}-${trigger.reminder_date}`,
    name: "取药提醒",
    type: "提醒",
    date: trigger.reminder_date,
    due_date: trigger.expected_shortage_date,
    description: `${trigger.name}预计余药 ${trigger.estimated} ${trigger.unit}，约可用 ${trigger.days} 天`,
    requirements:
      group.pickup_requirements || DEFAULT_PICKUP_REQUIREMENTS,
    remind_time:
      group.pickup_remind_time ||
      reminder?.pickup_remind_time ||
      DEFAULT_PICKUP_REMIND_TIME,
    status: "待完成",
    source: "系统余药计算",
    virtual: true,
    pickup: {
      drug_id: trigger.drug_id,
      drug_name: trigger.name,
      estimated: trigger.estimated,
      unit: trigger.unit,
      daily_quantity: trigger.daily_quantity,
      available_days: trigger.days,
      advance_days: trigger.advance_days,
      remind_time:
        group.pickup_remind_time ||
        reminder?.pickup_remind_time ||
        DEFAULT_PICKUP_REMIND_TIME,
      reminder_date: trigger.reminder_date,
      expected_shortage_date: trigger.expected_shortage_date,
    },
  };
}
