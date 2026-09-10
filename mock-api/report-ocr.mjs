const REPORT_TYPES = {
  blood: {
    match: ["血常规", "血细胞"],
    specimen: "全血",
    department: "医学检验科",
    metrics: [
      ["白细胞计数", "5.8", "10^9/L", "3.5-9.5", ""],
      ["中性粒细胞百分比", "61.2", "%", "40.0-75.0", ""],
      ["淋巴细胞百分比", "29.4", "%", "20.0-50.0", ""],
      ["红细胞计数", "3.82", "10^12/L", "3.8-5.1", ""],
      ["血红蛋白", "112", "g/L", "115-150", "偏低"],
      ["红细胞压积", "35.6", "%", "35.0-45.0", ""],
      ["血小板计数", "228", "10^9/L", "125-350", ""],
      ["平均血小板体积", "10.4", "fL", "7.0-13.0", ""],
    ],
    findings: [],
  },
  liver: {
    match: ["肝功能", "肝功"],
    specimen: "血清",
    department: "医学检验科",
    metrics: [
      ["丙氨酸氨基转移酶", "68", "U/L", "7-40", "偏高"],
      ["天门冬氨酸氨基转移酶", "54", "U/L", "13-35", "偏高"],
      ["碱性磷酸酶", "86", "U/L", "35-100", ""],
      ["γ-谷氨酰转移酶", "42", "U/L", "7-45", ""],
      ["总胆红素", "17.3", "μmol/L", "5.0-21.0", ""],
      ["直接胆红素", "4.8", "μmol/L", "0.0-7.0", ""],
      ["总蛋白", "72.5", "g/L", "65.0-85.0", ""],
      ["白蛋白", "43.1", "g/L", "40.0-55.0", ""],
    ],
    findings: [],
  },
  kidney: {
    match: ["肾功能", "肾功"],
    specimen: "血清",
    department: "医学检验科",
    metrics: [
      ["血清肌酐", "76", "μmol/L", "41-81", ""],
      ["尿素", "5.1", "mmol/L", "2.6-7.5", ""],
      ["尿酸", "286", "μmol/L", "155-357", ""],
      ["胱抑素C", "0.86", "mg/L", "0.51-1.09", ""],
      ["估算肾小球滤过率", "96", "mL/min/1.73m²", ">=90", ""],
      ["二氧化碳结合力", "25.2", "mmol/L", "22.0-29.0", ""],
    ],
    findings: [],
  },
  ct: {
    match: ["胸部ct", "ct", "影像"],
    specimen: "胸部 CT 影像",
    department: "医学影像科",
    metrics: [],
    findings: [
      ["检查方式", "胸部薄层 CT 平扫"],
      [
        "影像所见",
        "右上肺尖后段见斑片状、索条状高密度影，边界较前清晰；双肺未见新发明显实变。",
      ],
      ["影像结论", "右上肺病灶较前吸收，建议结合临床并按期复查。"],
    ],
  },
  smear: {
    match: ["痰涂片", "涂片"],
    specimen: "痰标本",
    department: "细菌室",
    metrics: [
      ["抗酸杆菌涂片", "阴性", "", "阴性", ""],
      ["标本性状", "合格", "", "合格", ""],
      ["鳞状上皮细胞", "8", "个/低倍视野", "<10", ""],
      ["白细胞", "18", "个/低倍视野", ">25提示炎症", ""],
    ],
    findings: [["报告结论", "本次标本未检出抗酸杆菌。"]],
  },
  culture: {
    match: ["痰培养", "培养"],
    specimen: "痰标本",
    department: "细菌室",
    metrics: [
      ["结核分枝杆菌培养", "未检出", "", "未检出", ""],
      ["培养方法", "液体培养", "", "", ""],
      ["培养时长", "42", "天", "", ""],
      ["污染状态", "无污染", "", "无污染", ""],
    ],
    findings: [["报告结论", "本次标本未检出结核分枝杆菌。"]],
  },
};

const cloneMetrics = (rows) =>
  rows.map(([name, value, unit, reference, flag]) => ({
    name,
    value,
    unit,
    reference,
    flag,
  }));

const typeKey = (type) => {
  const normalized = String(type || "")
    .replaceAll(" ", "")
    .toLowerCase();
  return (
    Object.entries(REPORT_TYPES).find(([, template]) =>
      template.match.some((keyword) => normalized.includes(keyword)),
    )?.[0] || ""
  );
};

export function supportedReportTypes() {
  return ["血常规", "肝功能", "肾功能", "胸部CT", "痰涂片", "痰培养"];
}

export function buildMockOcrResult({
  type,
  patient,
  examDate,
  files = [],
  extractedAt,
  sequence = 1,
}) {
  const key = typeKey(type);
  const template = REPORT_TYPES[key];
  const metrics = template ? cloneMetrics(template.metrics) : [];
  const findings = (template?.findings || []).map(([label, value]) => ({
    label,
    value,
  }));
  const reportNumber = `RPT-${String(examDate).replaceAll("-", "")}-${String(
    patient?.id || sequence,
  ).padStart(4, "0")}`;
  const sampleNumber = `S-${String(examDate).replaceAll("-", "")}-${String(
    sequence,
  ).padStart(3, "0")}`;
  const recognized = Boolean(template);
  const sections = [
    {
      key: "report",
      title: "报告信息",
      fields: [
        { label: "医疗机构", value: "结核病研究中心" },
        { label: "报告编号", value: reportNumber },
        { label: "报告类型", value: type || "未识别" },
        { label: "科室", value: template?.department || "待人工核对" },
        { label: "检查日期", value: examDate || "-" },
        { label: "报告日期", value: examDate || "-" },
      ],
    },
    {
      key: "patient",
      title: "患者信息",
      fields: [
        { label: "姓名", value: patient?.name || "-" },
        { label: "性别", value: patient?.gender_text || "-" },
        { label: "年龄", value: patient?.age ? `${patient.age}岁` : "-" },
        { label: "患者编号", value: patient?.patient_code || "-" },
      ],
    },
    {
      key: "sample",
      title: key === "ct" ? "检查信息" : "标本信息",
      fields: [
        {
          label: key === "ct" ? "检查部位" : "标本类型",
          value: template?.specimen || "-",
        },
        { label: key === "ct" ? "检查号" : "标本编号", value: sampleNumber },
        { label: "申请医生", value: "赵医师" },
        { label: key === "ct" ? "报告医师" : "审核者", value: "李医师" },
      ],
    },
  ];
  const fieldCount = sections.reduce(
    (count, section) => count + section.fields.length,
    0,
  );
  return {
    mode: "mock",
    status: recognized ? "completed" : "needs_review",
    status_text: recognized ? "解析完成" : "待人工补充",
    extracted_at: extractedAt,
    engine: "本地 Mock OCR",
    notice: recognized
      ? "为演示用结构化 OCR 结果，须与报告原件逐项核对后使用。"
      : "本地演示未识别出该类型的检验项目，请根据报告原件人工补充。",
    source_files: files.map((file, index) => ({
      name: file.name || `报告文件${index + 1}`,
      url: file.url,
      page: index + 1,
    })),
    sections,
    metrics,
    findings,
    summary: {
      file_count: files.length,
      field_count: fieldCount + metrics.length + findings.length,
      metric_count: metrics.length,
      abnormal_count: metrics.filter((metric) => metric.flag).length,
    },
  };
}

const xml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function renderMockReportSvg({ type, patient, examDate, ocrResult }) {
  const rows = ocrResult.metrics;
  const findings = ocrResult.findings;
  const patientFields = ocrResult.sections.find(
    (section) => section.key === "patient",
  ).fields;
  const reportFields = ocrResult.sections.find(
    (section) => section.key === "report",
  ).fields;
  const reportNumber = reportFields.find(
    (field) => field.label === "报告编号",
  )?.value;
  const rowMarkup = rows
    .map((row, index) => {
      const y = 395 + index * 42;
      return `<g><rect x="54" y="${y - 27}" width="852" height="42" fill="${index % 2 ? "#f8fafc" : "#ffffff"}"/><text x="72" y="${y}" class="cell">${xml(row.name)}</text><text x="390" y="${y}" class="cell ${row.flag ? "flag" : ""}">${xml(row.value)}</text><text x="520" y="${y}" class="cell">${xml(row.unit)}</text><text x="660" y="${y}" class="cell">${xml(row.reference)}</text><text x="838" y="${y}" class="cell flag">${xml(row.flag)}</text></g>`;
    })
    .join("");
  const findingStart = 420 + rows.length * 42;
  const findingMarkup = findings
    .map(
      (finding, index) =>
        `<text x="58" y="${findingStart + index * 62}" class="label">${xml(finding.label)}</text><text x="180" y="${findingStart + index * 62}" class="finding">${xml(finding.value)}</text>`,
    )
    .join("");
  const height = Math.max(
    860,
    findingStart + Math.max(findings.length, 1) * 72 + 120,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${height}" viewBox="0 0 960 ${height}"><style>.title{font:700 30px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;fill:#132238}.subtitle{font:14px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;fill:#64748b}.label{font:600 15px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;fill:#334155}.value,.cell,.finding{font:15px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;fill:#1e293b}.finding{font-size:14px}.head{font:600 14px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;fill:white}.flag{fill:#d14343;font-weight:600}</style><rect width="960" height="${height}" fill="#f1f5f9"/><rect x="30" y="24" width="900" height="${height - 48}" rx="12" fill="white" stroke="#dbe4ef"/><text x="480" y="78" text-anchor="middle" class="title">结核病研究中心 ${xml(type)}报告</text><text x="480" y="108" text-anchor="middle" class="subtitle">本文件为本地 Mock 演示资料，不用于医疗判断</text><line x1="54" y1="132" x2="906" y2="132" stroke="#dbe4ef"/><text x="58" y="170" class="label">姓名</text><text x="120" y="170" class="value">${xml(patient?.name || patientFields[0]?.value)}</text><text x="300" y="170" class="label">性别</text><text x="362" y="170" class="value">${xml(patient?.gender_text || patientFields[1]?.value)}</text><text x="510" y="170" class="label">年龄</text><text x="572" y="170" class="value">${xml(patientFields[2]?.value)}</text><text x="700" y="170" class="label">患者编号</text><text x="790" y="170" class="value">${xml(patient?.patient_code || patientFields[3]?.value)}</text><text x="58" y="210" class="label">检查日期</text><text x="145" y="210" class="value">${xml(examDate)}</text><text x="390" y="210" class="label">报告编号</text><text x="480" y="210" class="value">${xml(reportNumber)}</text><text x="700" y="210" class="label">科室</text><text x="755" y="210" class="value">${xml(reportFields[3]?.value)}</text><rect x="54" y="248" width="852" height="44" rx="6" fill="#316b9d"/><text x="72" y="276" class="head">解析项目</text><text x="390" y="276" class="head">结果</text><text x="520" y="276" class="head">单位</text><text x="660" y="276" class="head">参考范围</text><text x="838" y="276" class="head">标识</text>${rows.length ? rowMarkup : `<text x="480" y="350" text-anchor="middle" class="subtitle">该报告无数值检验项目，请查看下方影像所见与结论</text>`}${findingMarkup}<line x1="54" y1="${height - 112}" x2="906" y2="${height - 112}" stroke="#dbe4ef"/><text x="58" y="${height - 76}" class="label">报告医师：李医师</text><text x="700" y="${height - 76}" class="label">报告日期：${xml(examDate)}</text></svg>`;
}
