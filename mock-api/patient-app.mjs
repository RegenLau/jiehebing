import { effectiveProjectStatus } from "./project-status.mjs";
import { buildMockOcrResult } from "./report-ocr.mjs";
import {
  buildPickupReminderTask,
  calculatePatientStock,
} from "./pickup-reminder.mjs";

export function registerPatientApp({
  patientRoute,
  db,
  assert,
  clean,
  isDate,
  timestamp,
  nextId,
  today,
  shiftDate,
  randomUUID,
}) {
  db.patientConfirmationIssues ||= [];

  const issueText = (value, label) => {
    const text = clean(value);
    assert(text && text.length <= 300, `请填写${label}，不超过300字`);
    return text;
  };
  const latestActualTreatment = (patient) =>
    db.patientTreatments.filter((row) => row.user_id === patient.id).at(-1);
  const legacyTreatment = (patient) => {
    const medicines = db.medicines.filter((row) => row.user_id === patient.id);
    if (!medicines.length) return null;
    const group = db.projectGroups.find((row) => row.id === patient.group_id);
    const treatmentDays = group?.medication?.treatment_days || 0;
    return {
      id: `legacy-${patient.id}`,
      user_id: patient.id,
      source_group_id: patient.group_id,
      source_revision: group?.revision || 1,
      adjusted: false,
      adjustment_summary: [],
      start_date: patient.enroll_date,
      end_date: treatmentDays
        ? shiftDate(patient.enroll_date, treatmentDays - 1)
        : "",
      treatment_days: treatmentDays,
      drugs: medicines.map((medicine) => ({
        drug_id: medicine.common_medicine_id,
        name: medicine.name,
        specification: medicine.specification,
        dose: Number(medicine.dosage_value),
        unit: medicine.dosage_unit,
        times: medicine.plan_times,
        frequency: `每日${medicine.frequency}次`,
        precautions: medicine.medication_guidance,
      })),
      created_at: medicines[0].created_at,
      reason: "研究分组初始用药安排",
      legacy: true,
    };
  };
  const latestTreatment = (patient) =>
    latestActualTreatment(patient) || legacyTreatment(patient);
  const medicationStart = (treatment) => {
    if (!treatment?.start_date) return null;
    const time =
      treatment.drugs
        .flatMap((drug) => (Array.isArray(drug.times) ? drug.times : []))
        .filter((value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value))
        .sort()[0] || "00:00";
    return {
      date: treatment.start_date,
      time,
      start_at: `${treatment.start_date} ${time}`,
    };
  };
  const quantityFor = (patient, treatment, drugId) => {
    const dispense = db.dispensings
      .filter(
        (row) =>
          row.user_id === patient.id &&
          String(row.treatment_id) === String(treatment.id),
      )
      .at(-1);
    const issued = dispense?.items.find(
      (item) => item.drug_id === drugId,
    )?.quantity;
    if (issued !== undefined) return issued;
    const group = db.projectGroups.find((row) => row.id === patient.group_id);
    const planned = group?.medication?.quantities?.find(
      (item) => item.drug_id === drugId,
    )?.quantity;
    if (planned !== undefined) return planned;
    const medicine = db.medicines.find(
      (row) => row.user_id === patient.id && row.common_medicine_id === drugId,
    );
    return Number(medicine?.medicine_count || 0);
  };
  const medicationGuidanceFor = (drugId) =>
    db.commonMedicines.find((medicine) => medicine.id === drugId)
      ?.medication_guidance || "";
  const matchesTreatment = (confirmation, treatment) =>
    Boolean(
      confirmation &&
      treatment &&
      String(confirmation.treatment_id) === String(treatment.id),
    );
  const bootstrap = (patient) => {
    const currentProject = db.projects.find(
      (row) => row.id === patient.project_id,
    );
    const projectEnded =
      !currentProject || effectiveProjectStatus(currentProject, today()) === 2;
    const treatment = latestTreatment(patient);
    const start = medicationStart(treatment);
    const medicationCurrent = matchesTreatment(
      patient.medication_confirmation,
      treatment,
    );
    let stage = projectEnded ? "project_ended" : "identity";
    if (!projectEnded && patient.identity_confirmation?.status === "issue")
      stage = "identity_issue";
    else if (!projectEnded && patient.identity_confirmed) {
      if (
        patient.medication_confirmation?.status === "issue" &&
        medicationCurrent
      )
        stage = "medication_issue";
      else if (patient.medicine_confirmed && medicationCurrent)
        stage =
          start && start.start_at > timestamp().slice(0, 16)
            ? "pending_start"
            : "home";
      else stage = "medication";
    }
    return {
      stage,
      patient: {
        id: patient.id,
        patient_code: patient.patient_code,
        name: patient.name,
        mobile: patient.mobile,
        gender: patient.gender,
        gender_text: patient.gender_text,
        birth_date: patient.birth_date,
        project_name: patient.project_name,
        group_name: patient.group_name,
        enroll_date: patient.enroll_date,
        identity_confirmed: Boolean(patient.identity_confirmed),
        medicine_confirmed: Boolean(patient.medicine_confirmed),
      },
      treatment: treatment
        ? {
            ...treatment,
            drugs: treatment.drugs.map((drug) => ({
              ...drug,
              medication_guidance: medicationGuidanceFor(drug.drug_id),
              quantity: quantityFor(patient, treatment, drug.drug_id),
            })),
          }
        : null,
      medication_start: start,
      identity_confirmation: patient.identity_confirmation || null,
      medication_confirmation: medicationCurrent
        ? patient.medication_confirmation
        : null,
      project_end: projectEnded
        ? {
            project_id: currentProject?.id ?? null,
            project_name: currentProject?.name || patient.project_name || "",
            end_date: currentProject?.end_date || "",
            ended_manually: Boolean(currentProject?.manual_ended_at),
          }
        : null,
    };
  };
  const requireHome = (patient) => {
    const state = bootstrap(patient);
    assert(
      state.stage === "home",
      state.stage === "project_ended"
        ? "项目已结束，当前无法继续使用患者端小程序"
        : state.stage === "pending_start"
          ? "用药计划尚未开始，请在开始服药时间后进入"
          : "请先完成身份与用药确认",
    );
    return state;
  };
  const addIssue = (patient, type, note, treatmentId = null) => {
    const issue = {
      id: nextId(db.patientConfirmationIssues),
      user_id: patient.id,
      patient_name: patient.name,
      type,
      type_text: type === "identity" ? "基础信息有误" : "用药安排有疑问",
      treatment_id: treatmentId,
      note,
      status: "待处理",
      created_at: timestamp(),
    };
    db.patientConfirmationIssues.unshift(issue);
    return issue;
  };
  const log = (patient, action, note, after) => {
    db.patientHistory.unshift({
      id: nextId(db.patientHistory),
      user_id: patient.id,
      time: timestamp(),
      operator: "患者本人",
      action,
      reason: note || "患者端确认",
      before: {},
      after: structuredClone(after),
    });
  };
  const dateTime = (date, time) => `${date} ${time}`;
  const treatmentProgress = (patient, treatment) => {
    const total = Number(treatment?.treatment_days || 0);
    if (!treatment?.start_date || !total)
      return { current_day: 0, total_days: total };
    const elapsed =
      Math.floor(
        (Date.parse(`${today()}T00:00:00Z`) -
          Date.parse(`${treatment.start_date}T00:00:00Z`)) /
          86400000,
      ) + 1;
    return {
      current_day: Math.max(1, Math.min(total, elapsed)),
      total_days: total,
    };
  };
  const patientStock = (patient, treatment) =>
    calculatePatientStock({ db, patient, treatment, today, shiftDate });
  const medicationSlots = (patient) => {
    const activePlans = db.plans.filter(
      (row) => row.user_id === patient.id && row.status !== 3,
    );
    const keys = [
      ...new Set(activePlans.map((row) => `${row.plan_date}|${row.plan_time}`)),
    ].sort();
    return keys.map((key) => {
      const [date, time] = key.split("|");
      const plans = activePlans.filter(
        (row) => row.plan_date === date && row.plan_time === time,
      );
      return {
        id: key,
        date,
        time,
        timing:
          plans.find((row) => clean(row.medication_timing))
            ?.medication_timing || "",
        recordable: dateTime(date, time) <= timestamp().slice(0, 16),
        status: plans.every((row) => row.status === 1)
          ? "completed"
          : plans.every((row) => row.status === 2)
            ? "missed"
            : plans.some((row) => row.status === 2)
              ? "partial"
              : "pending",
        status_text: plans.every((row) => row.status === 1)
          ? "已全部服用"
          : plans.every((row) => row.status === 2)
            ? "明确未服"
            : plans.some((row) => row.status === 2)
              ? "部分未服"
              : "待记录",
        completed_count: plans.filter((row) => row.status === 1).length,
        total_count: plans.length,
        drugs: plans.map((row) => ({
          plan_id: row.id,
          drug_id: row.common_medicine_id,
          name: row.name,
          specification: row.specification,
          dose: Number(row.dosage_value),
          unit: row.dosage_unit,
          status: row.status,
          status_text: row.status_text,
          record_reason: row.record_reason || "",
          record_history: structuredClone(row.record_history || []),
        })),
      };
    });
  };
  const scheduledTasks = (patient, treatment) => {
    const group = db.projectGroups.find((row) => row.id === patient.group_id);
    if (!group || !treatment) return [];
    const result = [];
    for (const [kind, type, bindings] of [
      ["surveys", "问卷", group.surveys],
      ["tasks", null, group.tasks],
    ])
      for (const binding of bindings) {
        const anchor =
          binding.anchor === "date"
            ? binding.date
            : binding.anchor === "treatment"
              ? treatment.start_date
              : patient.enroll_date;
        let date = shiftDate(anchor, binding.offset_days);
        let iterations = 0;
        while (date <= treatment.end_date && iterations++ < 4000) {
          const dueDate = shiftDate(date, binding.deadline_days - 1);
          if (date >= treatment.start_date && dueDate >= today()) {
            result.push({
              id: `scheduled-${kind}-${binding.id}-${date}`,
              binding_kind: kind,
              binding_id: binding.id,
              snapshot: structuredClone(binding),
              name: binding.snapshot.name,
              type: type || binding.snapshot.type,
              date,
              due_date: dueDate,
              description: binding.snapshot.description || "",
              requirements: binding.snapshot.requirements || "",
              status: "待完成",
              source: "分组安排",
              virtual: true,
            });
          }
          if (!binding.interval_days) break;
          date = shiftDate(date, binding.interval_days);
        }
      }
    return result;
  };
  const taskSummary = (patient, treatment) => {
    const visibleThrough = shiftDate(today(), 14);
    const actual = db.followupTasks
      .filter(
        (row) =>
          row.user_id === patient.id &&
          ["待完成", "需补充"].includes(row.status) &&
          row.date <= visibleThrough,
      )
      .map((row) => ({ ...row, virtual: false }));
    const actualSchedules = new Set(
      db.followupTasks
        .filter((row) => row.user_id === patient.id)
        .map(
          (row) =>
            `${row.binding_kind || ""}-${row.binding_id || ""}-${row.date}`,
        ),
    );
    const planned = scheduledTasks(patient, treatment).filter((row) => {
      return (
        row.date <= visibleThrough &&
        !actualSchedules.has(
          `${row.binding_kind}-${row.binding_id}-${row.date}`,
        )
      );
    });
    const feedbackDone = db.feedback.some(
      (row) => row.user_id === patient.id && row.date === today(),
    );
    const feedback = feedbackDone
      ? []
      : [
          {
            id: `daily-feedback-${today()}`,
            name: "每日健康反馈",
            type: "健康反馈",
            date: today(),
            due_date: today(),
            description: "记录今天是否有身体不适或症状变化",
            requirements: "提交有无不适、症状变化和补充说明",
            status: "待完成",
            source: "每日任务",
            virtual: true,
          },
        ];
    const pickupReminder = buildPickupReminderTask({
      db,
      patient,
      treatment,
      today,
      shiftDate,
      visibleThrough,
    });
    return [
      ...feedback,
      ...(pickupReminder ? [pickupReminder] : []),
      ...actual,
      ...planned,
    ]
      .sort(
        (a, b) =>
          a.due_date.localeCompare(b.due_date) || a.date.localeCompare(b.date),
      )
      .map((row) => ({
        ...row,
        overdue: row.due_date < today(),
        form: row.type === "问卷" ? row.snapshot?.snapshot || null : null,
      }));
  };
  const assignedTasks = (patient) =>
    db.followupTasks
      .filter(
        (row) =>
          row.user_id === patient.id &&
          ["待完成", "需补充"].includes(row.status),
      )
      .sort((a, b) => b.id - a.id)
      .map((row) => ({
        ...row,
        virtual: false,
        overdue: row.due_date < today(),
        form: row.type === "问卷" ? row.snapshot?.snapshot || null : null,
      }));
  const patientTasks = (patient) => {
    const summary = taskSummary(patient, latestTreatment(patient));
    const summaryIds = new Set(summary.map((row) => String(row.id)));
    return [
      ...summary,
      ...assignedTasks(patient).filter(
        (row) => !summaryIds.has(String(row.id)),
      ),
    ].sort(
      (a, b) =>
        a.due_date.localeCompare(b.due_date) ||
        a.date.localeCompare(b.date) ||
        String(a.id).localeCompare(String(b.id)),
    );
  };
  const resolveTask = (patient, taskId) => {
    const numericId = Number(taskId);
    if (Number.isInteger(numericId) && numericId > 0) {
      const row = db.followupTasks.find(
        (task) => task.id === numericId && task.user_id === patient.id,
      );
      assert(row, "任务不存在", 404);
      return row;
    }
    const virtual = taskSummary(patient, latestTreatment(patient)).find(
      (task) => String(task.id) === String(taskId),
    );
    assert(virtual && virtual.binding_kind, "任务不存在或已完成", 404);
    const row = {
      ...virtual,
      id: nextId(db.followupTasks),
      user_id: patient.id,
      patient_name: patient.name,
      project_id: patient.project_id,
      group_id: patient.group_id,
      treatment_id: latestTreatment(patient)?.id || null,
      history: [],
      created_at: timestamp(),
    };
    delete row.virtual;
    delete row.overdue;
    delete row.form;
    db.followupTasks.push(row);
    return row;
  };
  const home = (patient) => {
    const treatment = latestTreatment(patient);
    const slots = medicationSlots(patient);
    const todaySlots = slots.filter((row) => row.date === today());
    const nextMedication =
      slots.find(
        (row) =>
          row.status === "pending" &&
          dateTime(row.date, row.time) >= dateTime(today(), "00:00"),
      ) || null;
    const tasks = taskSummary(patient, treatment).filter(
      (row) => row.source !== "患者端任务类型演示",
    );
    return {
      date: today(),
      patient: {
        id: patient.id,
        name: patient.name,
        project_name: patient.project_name,
        group_name: patient.group_name,
        study_state: patient.study_state || "待启用",
      },
      progress: treatmentProgress(patient, treatment),
      next_medication: nextMedication,
      medication_today: {
        total_slots: todaySlots.length,
        completed_slots: todaySlots.filter((row) => row.status === "completed")
          .length,
        pending_slots: todaySlots.filter((row) => row.status === "pending")
          .length,
        exception_slots: todaySlots.filter((row) =>
          ["partial", "missed"].includes(row.status),
        ).length,
      },
      pending_tasks: tasks,
      pending_task_count: tasks.length,
    };
  };
  const medication = (patient) => {
    const treatment = latestTreatment(patient);
    const slots = medicationSlots(patient);
    return {
      date: today(),
      slots: slots.filter((row) => row.date === today()),
      next_slot:
        slots.find((row) => row.status === "pending" && row.date === today()) ||
        null,
      history: slots
        .filter((row) => row.date <= today() && row.status !== "pending")
        .slice(-14)
        .reverse(),
      medicines: treatment
        ? treatment.drugs.map((drug) => ({
            ...drug,
            medication_guidance: medicationGuidanceFor(drug.drug_id),
            quantity: quantityFor(patient, treatment, drug.drug_id),
          }))
        : [],
      stock: patientStock(patient, treatment),
    };
  };
  const patientReports = (patient) =>
    [...db.reports]
      .filter((row) => row.user_id === patient.id)
      .sort((a, b) => b.exam_date.localeCompare(a.exam_date) || b.id - a.id);
  const reportFiles = (values) => {
    assert(
      Array.isArray(values) && values.length > 0 && values.length <= 10,
      "请上传1至10份报告",
    );
    return values.map((url) => {
      assert(
        typeof url === "string" && url.startsWith("/api/mock-files/"),
        "报告文件地址不正确",
      );
      const file = db.files.get(url.slice("/api/mock-files/".length));
      assert(
        file &&
          ["image/png", "image/jpeg", "image/gif", "application/pdf"].includes(
            file.type,
          ),
        "报告文件不存在或类型不支持",
      );
      return { url, name: file.name, type: file.type };
    });
  };
  const reportDetail = (patient, id) => {
    const report = db.reports.find(
      (row) => row.id === Number(id) && row.user_id === patient.id,
    );
    assert(report, "报告不存在", 404);
    const task = report.task_id
      ? db.followupTasks.find((row) => row.id === report.task_id)
      : null;
    return {
      ...report,
      task: task
        ? {
            id: task.id,
            name: task.name,
            type: task.type,
            date: task.date,
            due_date: task.due_date,
          }
        : null,
    };
  };
  const patientSupport = (patient) => {
    const group = db.projectGroups.find((row) => row.id === patient.group_id);
    const reminder = group?.reminder?.snapshot || null;
    const owner = db.admins.find(
      (row) => row.id === patient.owner_id && row.status === 1,
    );
    const project = db.projects.find((row) => row.id === patient.project_id);
    const preferences = patient.reminder_preferences || {
      medication: true,
      tasks: true,
      pickup: true,
    };
    const taskReminders = [
      ...(group?.surveys || []).map((item) => ({ ...item, kind: "随访问卷" })),
      ...(group?.tasks || [])
        .filter((item) => item.snapshot.system_kind !== "pickup")
        .map((item) => ({ ...item, kind: "随访任务" })),
    ].map((item) => ({
      id: `${item.kind}-${item.id}`,
      name: item.snapshot.name,
      kind: item.kind,
      remind_time: item.remind_time || reminder?.task_remind_time || "09:00",
    }));
    return {
      reminder: reminder
        ? {
            name: reminder.name,
            description: reminder.description,
            medication_enabled: reminder.medication_enabled,
            medication_advance_minutes: reminder.medication_advance_minutes,
            task_start_enabled: reminder.task_start_enabled,
            task_due_enabled: reminder.task_due_enabled,
            task_overdue_enabled: reminder.task_overdue_enabled,
            task_remind_time: reminder.task_remind_time,
            pickup_enabled: reminder.pickup_enabled,
            pickup_advance_days:
              group?.medication?.advance_days ?? reminder.pickup_advance_days,
            pickup_remind_time:
              group?.pickup_remind_time || reminder.pickup_remind_time,
          }
        : null,
      task_reminders: taskReminders,
      preferences: structuredClone(preferences),
      wechat_subscription: {
        available: false,
        authorized: false,
        note: "当前本地版本保留站内提醒；微信订阅消息需在真实小程序中由患者授权后接入",
      },
      contacts: [
        owner
          ? {
              id: `owner-${owner.id}`,
              name: owner.realname || owner.username,
              role: "随访负责人",
              phone: owner.phone || "",
              email: owner.email || "",
            }
          : null,
        project?.phone
          ? {
              id: `project-${project.id}`,
              name: project.center || project.name,
              role: "研究中心",
              phone: project.phone,
              email: "",
            }
          : null,
      ].filter(Boolean),
      articles: [...db.articles]
        .filter((row) => row.status === 1)
        .sort((a, b) => b.sort - a.sort || b.id - a.id)
        .slice(0, 6)
        .map((row) => ({
          id: row.id,
          title: row.title,
          summary: row.summary,
          content: row.content,
          published_at: row.published_at,
        })),
    };
  };

  patientRoute("GET", "/app/patient/archive-detail", ({ patient }) => patient);
  patientRoute("GET", "/app/patient/bootstrap", ({ patient }) =>
    bootstrap(patient),
  );
  patientRoute("GET", "/app/patient/home", ({ patient }) => {
    requireHome(patient);
    return home(patient);
  });
  patientRoute("GET", "/app/patient/medication", ({ patient }) => {
    requireHome(patient);
    return medication(patient);
  });
  patientRoute("GET", "/app/patient/tasks", ({ patient }) => {
    requireHome(patient);
    return {
      date: today(),
      tasks: patientTasks(patient),
    };
  });
  patientRoute("GET", "/app/patient/reports", ({ patient }) => ({
    reports: patientReports(patient),
  }));
  patientRoute("GET", "/app/patient/report-detail", ({ patient, query }) =>
    reportDetail(patient, query.id),
  );
  patientRoute("GET", "/app/patient/support", ({ patient }) =>
    patientSupport(patient),
  );
  patientRoute(
    "POST",
    "/app/patient/reminder-preferences",
    ({ patient, body }) => {
      for (const key of ["medication", "tasks", "pickup"])
        assert(typeof body[key] === "boolean", "提醒偏好不完整");
      patient.reminder_preferences = {
        medication: body.medication,
        tasks: body.tasks,
        pickup: body.pickup,
      };
      log(
        patient,
        "患者更新提醒偏好",
        "仅调整消息提醒偏好，不改变研究任务与用药安排",
        patient.reminder_preferences,
      );
      return patientSupport(patient);
    },
  );
  patientRoute(
    "POST",
    "/app/patient/file-upload",
    async ({ patient, body }) => {
      const file = body.get?.("file");
      assert(
        file && typeof file.arrayBuffer === "function",
        "请选择报告图片或PDF",
      );
      assert(
        ["image/jpeg", "image/png", "image/gif", "application/pdf"].includes(
          file.type,
        ),
        "仅支持 JPG、PNG、GIF 图片和 PDF 文件",
      );
      assert(file.size <= 10 * 1024 * 1024, "单个文件不能超过10MB");
      const id = randomUUID();
      db.files.set(id, {
        buffer: Buffer.from(await file.arrayBuffer()),
        type: file.type,
        name: file.name,
        patient_id: patient.id,
        created_at: timestamp(),
      });
      return { url: `/api/mock-files/${id}`, name: file.name, type: file.type };
    },
  );
  patientRoute("POST", "/app/patient/report-submit", ({ patient, body }) => {
    const documents = reportFiles(body.files);
    const note = clean(body.note);
    assert(note.length <= 200, "备注不能超过200字");
    if (body.report_id) {
      const report = db.reports.find(
        (row) =>
          row.id === Number(body.report_id) && row.user_id === patient.id,
      );
      assert(report, "报告不存在", 404);
      assert(report.status === "需补充", "当前报告不需要补充");
      report.versions.push({
        files: documents,
        note,
        time: timestamp(),
        operator: "患者本人",
      });
      report.ocr_result = buildMockOcrResult({
        type: report.type,
        patient,
        examDate: report.exam_date,
        files: report.versions.flatMap((version) => version.files),
        extractedAt: timestamp(),
        sequence: report.id,
      });
      report.metrics = structuredClone(report.ocr_result.metrics);
      report.status = "待患者确认";
      report.ocr_status = "待患者核对";
      report.ocr_original = {
        type: report.type,
        exam_date: report.exam_date,
        metrics: structuredClone(report.ocr_result.metrics),
      };
      report.updated_at = timestamp();
      return reportDetail(patient, report.id);
    }
    const type = clean(body.type);
    assert(type && type.length <= 100, "请选择报告类型");
    assert(
      isDate(body.exam_date) && body.exam_date <= today(),
      "请选择有效且不晚于今天的检查日期",
    );
    let task = null;
    if (body.task_id) {
      task = resolveTask(patient, body.task_id);
      assert(task.type === "检查", "该任务不支持上传报告");
      assert(!["已完成", "已取消"].includes(task.status), "任务已经结束");
      assert(
        !db.reports.some((row) => row.task_id === task.id),
        "该任务已有报告，请进入原报告补充",
      );
    }
    const row = {
      id: nextId(db.reports),
      user_id: patient.id,
      patient_name: patient.name,
      type,
      exam_date: body.exam_date,
      task_id: task?.id || null,
      status: "待患者确认",
      ocr_status: "待患者核对",
      ocr_result: null,
      ocr_original: null,
      metrics: [],
      patient_corrections: null,
      versions: [
        { files: documents, note, time: timestamp(), operator: "患者本人" },
      ],
      history: [],
      created_at: timestamp(),
      updated_at: timestamp(),
    };
    row.ocr_result = buildMockOcrResult({
      type,
      patient,
      examDate: body.exam_date,
      files: documents,
      extractedAt: timestamp(),
      sequence: row.id,
    });
    row.metrics = structuredClone(row.ocr_result.metrics);
    row.ocr_original = {
      type,
      exam_date: body.exam_date,
      metrics: structuredClone(row.metrics),
    };
    db.reports.push(row);
    return reportDetail(patient, row.id);
  });
  patientRoute("POST", "/app/patient/report-confirm", ({ patient, body }) => {
    const report = db.reports.find(
      (row) => row.id === Number(body.id) && row.user_id === patient.id,
    );
    assert(report, "报告不存在", 404);
    assert(report.status === "待患者确认", "报告当前不需要患者核对");
    const type = clean(body.type);
    const examDate = body.exam_date;
    assert(type && type.length <= 100, "请核对报告类型");
    assert(isDate(examDate) && examDate <= today(), "请核对检查日期");
    assert(
      Array.isArray(body.metrics) && body.metrics.length <= 100,
      "指标列表不正确",
    );
    const metrics = body.metrics.map((item) => {
      const name = clean(item.name);
      const value = clean(item.value);
      const flag = clean(item.flag);
      assert(name && value, "指标名称和检测值不能为空");
      assert(["", "偏低", "偏高", "异常"].includes(flag), "异常标识不正确");
      return {
        name,
        value,
        unit: clean(item.unit),
        reference: clean(item.reference),
        flag,
      };
    });
    report.patient_corrections = {
      type,
      exam_date: examDate,
      metrics: structuredClone(metrics),
      note: clean(body.note),
      confirmed_at: timestamp(),
    };
    report.type = type;
    report.exam_date = examDate;
    report.metrics = metrics;
    report.status = "待核对";
    report.ocr_status = "患者已核对";
    report.updated_at = timestamp();
    report.history.push({
      time: timestamp(),
      operator: "患者本人",
      reason: clean(body.note) || "患者核对识别信息",
      before: structuredClone(report.ocr_original),
      after: { type, exam_date: examDate, metrics: structuredClone(metrics) },
    });
    if (report.task_id) {
      const task = db.followupTasks.find((row) => row.id === report.task_id);
      if (task && task.status !== "已取消") task.status = "已提交";
    }
    log(patient, "患者提交检查报告", `${type} · ${examDate}`, {
      report_id: report.id,
      task_id: report.task_id,
    });
    return reportDetail(patient, report.id);
  });
  patientRoute(
    "POST",
    "/app/patient/medication-checkin",
    ({ patient, body }) => {
      requireHome(patient);
      const plan = db.plans.find((row) => row.id === Number(body.id));
      assert(plan && plan.user_id === patient.id, "服药计划不存在", 404);
      assert(plan.status !== 3, "该服药计划已取消");
      assert(
        patient.study_state !== "暂停用药",
        "当前用药已暂停，请按医生最新安排执行",
      );
      assert(
        dateTime(plan.plan_date, plan.plan_time) <= timestamp().slice(0, 16),
        "未到服药时间，暂不能打卡",
      );
      if (plan.status === 1) return medication(patient);
      const before = { status: plan.status, checked_at: plan.checked_at };
      plan.status = 1;
      plan.status_text = "已服药";
      plan.checked_at = timestamp();
      plan.record_reason = "患者本人打卡";
      plan.record_history ||= [];
      plan.record_history.push({
        time: timestamp(),
        operator: "患者本人",
        before,
        after: { status: 1, checked_at: plan.checked_at },
        reason: "患者本人确认已服药",
      });
      log(
        patient,
        "患者服药打卡",
        `${plan.plan_date} ${plan.plan_time} ${plan.name}`,
        {
          plan_id: plan.id,
          status: plan.status,
          checked_at: plan.checked_at,
        },
      );
      return medication(patient);
    },
  );
  patientRoute("POST", "/app/patient/medication-slot", ({ patient, body }) => {
    requireHome(patient);
    assert(
      patient.study_state !== "暂停用药",
      "当前用药已暂停，请按医生最新安排执行",
    );
    const slotId = clean(body.id);
    const [planDate, planTime] = slotId.split("|");
    assert(
      isDate(planDate) && /^([01]\d|2[0-3]):[0-5]\d$/.test(planTime || ""),
      "服药时点不正确",
    );
    assert(
      dateTime(planDate, planTime) <= timestamp().slice(0, 16),
      "未到服药时间，暂不能记录",
    );
    const plans = db.plans.filter(
      (row) =>
        row.user_id === patient.id &&
        row.plan_date === planDate &&
        row.plan_time === planTime &&
        row.status !== 3,
    );
    assert(plans.length > 0, "服药时点不存在", 404);
    assert(Array.isArray(body.taken_plan_ids), "请选择本次实际服用的药品");
    const takenIds = body.taken_plan_ids.map(Number);
    assert(new Set(takenIds).size === takenIds.length, "服药记录不能重复");
    assert(
      takenIds.every((id) => plans.some((plan) => plan.id === id)),
      "服药记录包含其他时点的药品",
    );
    const unchanged = plans.every(
      (plan) => plan.status === (takenIds.includes(plan.id) ? 1 : 2),
    );
    if (unchanged) return medication(patient);
    const note = clean(body.note);
    const correcting = plans.some((plan) => [1, 2].includes(plan.status));
    assert(
      (takenIds.length === plans.length && !correcting) ||
        (note && note.length <= 1000),
      "部分未服或更正记录时请填写说明",
    );
    for (const plan of plans) {
      const status = takenIds.includes(plan.id) ? 1 : 2;
      const before = {
        status: plan.status,
        checked_at: plan.checked_at || "",
        record_reason: plan.record_reason || "",
      };
      plan.status = status;
      plan.status_text = status === 1 ? "已服（患者确认）" : "明确未服";
      plan.checked_at = status === 1 ? timestamp() : "";
      plan.record_reason = note || "患者本人确认本次全部已服";
      plan.record_history ||= [];
      plan.record_history.push({
        time: timestamp(),
        operator: "患者本人",
        before,
        after: {
          status,
          checked_at: plan.checked_at,
          record_reason: plan.record_reason,
        },
        reason: plan.record_reason,
      });
    }
    const resultText =
      takenIds.length === plans.length
        ? "全部已服"
        : takenIds.length
          ? "部分未服"
          : "本次未服";
    log(
      patient,
      correcting ? "患者更正服药记录" : "患者提交服药记录",
      `${planDate} ${planTime} · ${resultText} · ${note}`,
      {
        slot_id: slotId,
        taken_plan_ids: takenIds,
        total_count: plans.length,
      },
    );
    return medication(patient);
  });
  patientRoute("POST", "/app/patient/feedback", ({ patient, body }) => {
    const symptoms = [
      "咳嗽",
      "咳痰",
      "发热",
      "盗汗",
      "乏力",
      "食欲下降",
      "体重下降",
      "胸闷气短",
      "其他",
    ];
    const changes = ["首次记录", "减轻", "无变化", "加重", "新出现", "消失"];
    assert(
      !db.feedback.some(
        (row) => row.user_id === patient.id && row.date === today(),
      ),
      "今天已经提交过健康反馈",
    );
    assert(typeof body.no_discomfort === "boolean", "请确认今天是否有身体不适");
    assert(Array.isArray(body.symptoms), "症状格式不正确");
    assert(
      body.no_discomfort
        ? body.symptoms.length === 0
        : body.symptoms.length > 0,
      "请选择无不适或至少一种症状",
    );
    assert(
      new Set(body.symptoms.map((item) => item.name)).size ===
        body.symptoms.length,
      "症状不能重复",
    );
    assert(
      body.symptoms.every(
        (item) => symptoms.includes(item.name) && changes.includes(item.change),
      ),
      "请选择有效的症状和变化",
    );
    const note = clean(body.note);
    assert(note.length <= 2000, "补充说明不能超过2000字");
    const row = {
      id: nextId(db.feedback),
      user_id: patient.id,
      patient_name: patient.name,
      date: today(),
      no_discomfort: body.no_discomfort,
      symptoms: structuredClone(body.symptoms),
      note,
      source: "患者端每日反馈",
      operator: "患者本人",
      created_at: timestamp(),
    };
    db.feedback.push(row);
    log(
      patient,
      "患者提交每日健康反馈",
      note || (body.no_discomfort ? "今日无不适" : "已记录症状变化"),
      row,
    );
    return {
      feedback: row,
      tasks: patientTasks(patient),
    };
  });
  patientRoute("POST", "/app/patient/adverse-report", ({ patient, body }) => {
    requireHome(patient);
    const symptomOptions = [
      "皮肤瘙痒",
      "皮疹",
      "恶心呕吐",
      "腹泻腹痛",
      "关节痛",
      "视力模糊",
      "头痛头晕",
      "发热",
      "其他",
    ];
    const occurredAt = clean(body.occurred_at);
    assert(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(occurredAt),
      "请选择症状发生时间",
    );
    assert(
      isDate(occurredAt.slice(0, 10)) && occurredAt <= timestamp(),
      "发生时间不能晚于当前时间",
    );
    assert(
      Array.isArray(body.symptoms) && body.symptoms.length > 0,
      "请至少选择一种主要症状",
    );
    const symptoms = body.symptoms.map(clean);
    assert(new Set(symptoms).size === symptoms.length, "主要症状不能重复");
    assert(
      symptoms.every((symptom) => symptomOptions.includes(symptom)),
      "请选择有效的主要症状",
    );
    const symptomDescription = clean(body.description);
    assert(
      symptomDescription && symptomDescription.length <= 2000,
      "请填写症状描述，不超过2000字",
    );
    const severity = Number(body.severity);
    assert([1, 2, 3].includes(severity), "请选择严重程度");
    const severityText = ["轻度", "中度", "重度"][severity - 1];
    const adviceText =
      severity === 3
        ? "请立即停药并前往医院就诊，请勿等待在线回复。"
        : severity === 2
          ? "请密切观察症状，并尽快联系随访医生评估。"
          : "请继续观察；如症状加重或持续不缓解，请及时联系随访医生。";
    const row = {
      id: nextId(db.adverse),
      user_id: patient.id,
      patient_name: patient.name,
      patient_mobile: patient.mobile,
      occurred_at: occurredAt,
      symptoms,
      symptom_summary: symptoms.join("、"),
      symptom_description: symptomDescription,
      severity,
      severity_text: severityText,
      advice_text: adviceText,
      status: 1,
      status_text: "已上报",
      processing_status: "待处理",
      created_at: timestamp(),
    };
    db.adverse.unshift(row);
    log(
      patient,
      "患者上报不良反应",
      `${severityText} · ${row.symptom_summary}`,
      row,
    );
    return row;
  });
  patientRoute("POST", "/app/patient/survey-submit", ({ patient, body }) => {
    const task = resolveTask(patient, body.task_id);
    assert(
      task.type === "问卷" && task.binding_kind === "surveys",
      "该任务不是问卷",
    );
    assert(!["已完成", "已取消"].includes(task.status), "该轮问卷已经结束");
    assert(
      !db.answers.some(
        (answer) => answer.user_id === patient.id && answer.task_id === task.id,
      ),
      "该轮问卷已经提交",
    );
    const survey = task.snapshot?.snapshot;
    assert(survey?.questions?.length, "问卷内容不存在");
    assert(Array.isArray(body.answers), "问卷答案格式不正确");
    const values = survey.questions.map((question) => {
      const answer =
        body.answers.find((item) => Number(item.question_id) === question.id) ||
        {};
      const optionIds = Array.isArray(answer.option_ids)
        ? answer.option_ids.map(Number)
        : [];
      const textValue = clean(answer.text_value);
      const validOptions = question.options.map((option) => option.id);
      assert(
        optionIds.every((id) => validOptions.includes(id)),
        `第${question.questionNo}题选项不合法`,
      );
      if (question.type === "RADIO")
        assert(
          optionIds.length === 1 || !question.required,
          `请完成第${question.questionNo}题`,
        );
      if (question.type === "CHECKBOX") {
        assert(
          optionIds.length > 0 || !question.required,
          `请完成第${question.questionNo}题`,
        );
        const exclusive = question.options.find(
          (option) => option.isExclusive && optionIds.includes(option.id),
        );
        assert(
          !exclusive || optionIds.length === 1,
          `第${question.questionNo}题的“${exclusive?.label}”不能与其他选项同时选择`,
        );
      }
      if (question.type === "TEXT")
        assert(
          textValue || !question.required,
          `请完成第${question.questionNo}题`,
        );
      for (const option of question.options.filter(
        (item) => item.triggerInput && optionIds.includes(item.id),
      )) {
        for (const field of option.inputFields || [])
          if (field.required) {
            assert(
              clean(answer.extra_inputs?.[field.field_key]),
              `请补充第${question.questionNo}题的${field.field_label}`,
            );
          }
      }
      return {
        question_id: question.id,
        option_ids: optionIds,
        text_value: textValue,
        extra_inputs: structuredClone(answer.extra_inputs || {}),
      };
    });
    const submission = {
      user_id: patient.id,
      template_id: survey.id,
      task_id: task.id,
      submitted_at: timestamp(),
      values,
      template_snapshot: structuredClone(survey),
    };
    db.answers.push(submission);
    task.status = "已完成";
    task.result = "患者本人提交问卷";
    task.history ||= [];
    task.history.unshift({
      time: timestamp(),
      operator: "患者本人",
      action: "提交问卷",
      reason: "患者本人提交本轮问卷",
    });
    log(patient, "患者提交随访问卷", `${survey.name} · ${task.date}`, {
      task_id: task.id,
      template_id: survey.id,
    });
    return {
      submission,
      tasks: patientTasks(patient),
    };
  });
  patientRoute("POST", "/app/patient/task-complete", ({ patient, body }) => {
    const task = resolveTask(patient, body.task_id);
    assert(task.type === "提醒", "该任务需要通过对应页面提交");
    assert(!["已完成", "已取消"].includes(task.status), "任务已经结束");
    const note = clean(body.note) || "患者确认已完成";
    assert(note.length <= 1000, "完成说明不能超过1000字");
    task.status = "已完成";
    task.result = note;
    task.history ||= [];
    task.history.unshift({
      time: timestamp(),
      operator: "患者本人",
      action: "确认完成",
      reason: note,
    });
    log(patient, `患者完成${task.type}任务`, note, {
      task_id: task.id,
      status: task.status,
    });
    return { task, tasks: patientTasks(patient) };
  });
  patientRoute("POST", "/app/patient/confirm-identity", ({ patient, body }) => {
    assert(typeof body.confirmed === "boolean", "请选择资料是否正确");
    const note = body.confirmed
      ? clean(body.note).slice(0, 300)
      : issueText(body.note, "错误说明");
    const confirmation = {
      status: body.confirmed ? "confirmed" : "issue",
      confirmed: body.confirmed,
      note,
      confirmed_at: timestamp(),
    };
    patient.identity_confirmed = body.confirmed;
    patient.identity_confirmation = confirmation;
    if (!body.confirmed)
      confirmation.issue_id = addIssue(patient, "identity", note).id;
    log(
      patient,
      body.confirmed ? "患者确认基础信息" : "患者反馈基础信息有误",
      note,
      confirmation,
    );
    return bootstrap(patient);
  });
  patientRoute(
    "POST",
    "/app/patient/confirm-medication",
    ({ patient, body }) => {
      assert(patient.identity_confirmed, "请先确认基础信息");
      assert(typeof body.confirmed === "boolean", "请选择用药安排是否正确");
      const treatment = latestTreatment(patient);
      assert(treatment, "医生尚未配置用药安排，请联系工作人员");
      assert(
        String(body.treatment_id) === String(treatment.id),
        "用药安排已更新，请刷新后重新核对",
      );
      const note = body.confirmed
        ? clean(body.note).slice(0, 300)
        : issueText(body.note, "疑问说明");
      const confirmation = {
        status: body.confirmed ? "confirmed" : "issue",
        confirmed: body.confirmed,
        treatment_id: treatment.id,
        note,
        confirmed_at: timestamp(),
      };
      patient.medicine_confirmed = body.confirmed;
      patient.medication_confirmation = confirmation;
      if (!body.confirmed)
        confirmation.issue_id = addIssue(
          patient,
          "medication",
          note,
          treatment.id,
        ).id;
      log(
        patient,
        body.confirmed ? "患者确认用药安排" : "患者反馈用药安排有疑问",
        note,
        confirmation,
      );
      return bootstrap(patient);
    },
  );
}
