// Group card edits are local snapshots; reusable medication templates stay unchanged.
export function normalizeGroupDrugs(values, { db, assert, find, clean }, previous = []) {
  assert(Array.isArray(values) && values.length > 0 && values.length <= 50, '请添加1至50种药品');
  assert(new Set(values.map(d => d.drug_id)).size === values.length, '同一种药品不能重复添加');
  return values.map(d => {
    const medicine = find(db.commonMedicines, d.drug_id, '药品');
    assert(medicine.status === 1 || previous.some(item => item.drug_id === medicine.id), '停用药品不能新增到分组');
    assert(d.confirmed === true, '请先确认全部药品，再保存用药方案');
    const name = clean(d.name), specification = clean(d.specification);
    assert(name && name.length <= 100, '请填写有效的药品名称');
    assert(specification && specification.length <= 100, '请填写有效的药品规格');
    const dose = String(d.dose ?? '').trim(), unit = clean(d.unit);
    assert(/^\d+(\.\d{1,3})?$/.test(dose) && Number(dose) > 0 && Number(dose) <= 100000, '每次剂量须大于0，最多保留3位小数');
    assert(unit && unit.length <= 20, '请填写有效的剂量单位');
    assert(Number.isInteger(d.daily_count) && d.daily_count >= 1 && d.daily_count <= 4, '每日次数请选择1至4次');
    assert(Array.isArray(d.reminders) && d.reminders.length === d.daily_count, '提醒时间数量须与每日次数一致');
    const reminders = d.reminders.map(item => {
      const time = clean(item.time), timing = clean(item.timing);
      assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(time), '请填写有效的提醒时间');
      assert(['餐后', '餐前', '睡前', '空腹'].includes(timing), '请选择服药时机');
      return { time, timing };
    });
    assert(new Set(reminders.map(item => item.time)).size === reminders.length, '同一药品的提醒时间不能重复');
    assert(Number.isInteger(d.quantity) && d.quantity > 0 && d.quantity <= 100000, '药品量应为1至100000的整数');
    assert(clean(d.precautions).length <= 1000, '注意事项不能超过1000字');
    return { drug_id:medicine.id, name, specification, dose, unit,
      daily_count:d.daily_count, frequency:`每日${d.daily_count}次`, times:reminders.map(item=>item.time).join(','),
      reminders, quantity:d.quantity, precautions:clean(d.precautions), confirmed:true };
  });
}

export function registerPrescriptionRecognition({ core, db, assert, clean }) {
  const recognize = ({ body }) => {
    const url = clean(body.url), match = url.match(/^\/api\/mock-files\/([\w-]+)$/);
    const file = match && db.files.get(match[1]);
    assert(file && file.type.startsWith('image/'), '请先上传有效的处方图片');
    return { mode:'mock', message:'本地演示识别结果，不代表图片中的真实药品，请逐项核对。', url,
      drugs:db.commonMedicines.filter(d=>d.status===1).slice(0,2).map(d=>({drug_id:d.id,name:d.common_name,specification:d.specification,
        dose:'1',unit:d.dosage_unit||'片',daily_count:1,frequency:'每日1次',times:'07:00',reminders:[{time:'07:00',timing:'餐后'}],
        quantity:30,precautions:'',confirmed:false})) };
  };
  core('POST', 'medication-scheme/recognize-prescription', recognize);
  core('POST', 'project/recognize-prescription', recognize);
}
