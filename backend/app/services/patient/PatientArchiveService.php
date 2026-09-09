<?php

namespace app\services\patient;

use app\exception\ServiceException;
use app\model\CommonMedicineModel;
use app\model\HospitalModel;
use app\model\UserMedicationPlanModel;
use app\model\UserModel;
use app\model\UserMedicineModel;
use app\services\ai\AliBaiLianService;
use app\services\ai\AliDifyService;
use app\services\FileService;
use support\Db;
use support\Log;

class PatientArchiveService
{

    protected AliDifyService $aliDifyService;

    protected AliBaiLianService $aliBaiLianService;

    protected FileService $fileService;


    public function __construct()
    {
        $this->aliDifyService     = new AliDifyService();
        $this->aliBaiLianService  = new AliBaiLianService();
        $this->fileService        = new FileService();
    }

    public function getDetail(int $userId): array
    {
        $user = UserModel::query()->find($userId);
        if (!$user) {
            throw new ServiceException('用户不存在');
        }

        $data = $user->toArray();
        return [
            'id'              => (int)$user->id,
            'is_archived'     => (int)!empty($data['is_archived']),
            'hospital_id'     => (int)($data['hospital_id'] ?? 0),
            'hospital_name'   => (string)($data['hospital_name'] ?? ''),
            'department_name' => (string)($data['department_name'] ?? ''),
            'visit_type'      => (int)($data['visit_type'] ?? 0),
            'visit_type_text' => $this->visitTypeText((int)($data['visit_type'] ?? 0)),
            'name'            => (string)($data['name'] ?? ''),
            'gender'          => (int)($data['gender'] ?? 0),
            'age'             => isset($data['age']) ? (int)$data['age'] : 0,
            'mobile'          => (string)($data['mobile'] ?? ''),
        ];
    }

    public function getMedicineList(int $userId): array
    {
        $user = UserModel::query()->find($userId);
        if (!$user) {
            throw new ServiceException('用户不存在');
        }

        return $this->getUserMedicines($userId);
    }

    public function getHospitalList(): array
    {
        return HospitalModel::query()
            ->orderBy('id')
            ->get(['id', 'code', 'name'])
            ->map(fn($item) => [
                'id'   => (int)$item->id,
                'code' => (string)$item->code,
                'name' => (string)$item->name,
            ])->toArray();
    }

    public function getReminderSetting(int $userId): array
    {
        $user = UserModel::query()->find($userId);
        if (!$user) {
            throw new ServiceException('用户不存在');
        }

        $setting = json_decode((string)($user->reminder_setting ?? ''), true);
        if (!is_array($setting)) {
            $setting = [];
        }

        return [
            'breakfast_time' => (string)($setting['breakfast_time'] ?? ''),
            'lunch_time'     => (string)($setting['lunch_time'] ?? ''),
            'dinner_time'    => (string)($setting['dinner_time'] ?? ''),
            'sleep_time'     => (string)($setting['sleep_time'] ?? ''),
        ];
    }

    public function getMedicationPlan(int $userId): array
    {
        $this->assertUserExists($userId);

        $totalDays  = $this->getMedicationPlanDays();
        $today      = date('Y-m-d');
        $todayDay   = UserMedicationPlanModel::query()
            ->where('user_id', $userId)
            ->where('plan_date', '<=', $today)
            ->max('day_number');
        $currentDay = max(1, min($totalDays, (int)$todayDay ?: 1));

        $todayPlans     = UserMedicationPlanModel::query()
            ->where('user_id', $userId)
            ->where('plan_date', $today)
            ->count();
        $todayCompleted = UserMedicationPlanModel::query()
            ->where('user_id', $userId)
            ->where('plan_date', $today)
            ->where('status', 1)
            ->count();

        return [
            'current_day'      => $currentDay,
            'total_days'       => $totalDays,
            'progress_percent' => $totalDays > 0 ? round($currentDay / $totalDays * 100, 2) : 0,
            'current_batch_no' => $this->getCurrentBatchNo($userId),
            'today_total'      => $todayPlans,
            'today_completed'  => $todayCompleted,
            'today_pending'    => max(0, $todayPlans - $todayCompleted),
            'status'           => $currentDay >= $totalDays ? 'completed' : 'ongoing',
            'status_text'      => $currentDay >= $totalDays ? '已完成治疗' : '正常治疗中',
        ];
    }

    public function getTodayMedicationPlans(int $userId): array
    {
        $this->assertUserExists($userId);
        $today = date('Y-m-d');
        $planItems = UserMedicationPlanModel::query()
            ->where('user_id', $userId)
            ->where('plan_date', $today)
            ->orderBy('plan_time')
            ->orderBy('id')
            ->get([
                'id',
                'medicine_id',
                'plan_date',
                'day_number',
                'plan_time',
                'plan_index',
                'name',
                'specification',
                'usage',
                'frequency',
                'dosage',
                'dosage_value',
                'dosage_unit',
                'status',
                'checked_at',
            ]);

        $thumbMap = UserMedicineModel::query()
            ->whereIn('id', $planItems->pluck('medicine_id')->map(fn($id) => (int)$id)->unique()->values()->all())
            ->get(['id', 'thumb'])
            ->mapWithKeys(fn($item) => [
                (int)$item->id => (string)($item->thumb ?? ''),
            ])
            ->toArray();
        $plans = $planItems->map(function ($item) use ($userId, $thumbMap) {
                return [
                    'id'            => (int)$item->id,
                    'medicine_id'   => (int)$item->medicine_id,
                    'batch_no'      => $this->getMedicineBatchNo($userId, (int)$item->medicine_id),
                    'plan_date'     => (string)$item->plan_date,
                    'day_number'    => (int)$item->day_number,
                    'plan_time'     => (string)($item->plan_time ?? ''),
                    'plan_index'    => (int)($item->plan_index ?? 1),
                    'name'          => (string)$item->name,
                    'specification' => (string)$item->specification,
                    'usage'         => (string)$item->usage,
                    'frequency'     => (int)$item->frequency,
                    'dosage'        => (string)$item->dosage,
                    'dosage_value'  => (string)($item->dosage_value ?? ''),
                    'dosage_unit'   => (string)($item->dosage_unit ?? ''),
                    'thumb'         => $thumbMap[(int)$item->medicine_id] ?? '',
                    'status'        => (int)$item->status,
                    'status_text'   => (int)$item->status === 1 ? '已打卡' : '待打卡',
                    'checked_at'    => $item->checked_at ? (string)$item->checked_at : '',
                ];
            })->toArray();

        return [
            'summary' => [
                'date'      => $today,
                'total'     => count($plans),
                'completed' => count(array_filter($plans, fn($item) => $item['status'] === 1)),
            ],
            'list'    => $plans,
        ];
    }

    public function save(int $userId, array $data): array
    {
        $user = UserModel::query()->find($userId);
        if (!$user) {
            throw new ServiceException('用户不存在');
        }
        if (!empty($data['hospital_id'])) {
            $hospital = HospitalModel::query()->find($data['hospital_id']);
            if (!$hospital) {
                throw new ServiceException('就诊医院不存在');
            }
            $data['hospital_name'] = $hospital->name;
        }
        Db::beginTransaction();
        try {
            if (empty($user->mobile)) {
                throw new ServiceException('请先完成微信手机号授权');
            }
            $user->hospital_id     = $data['hospital_id'] ?? 0;
            $user->hospital_name   = $data['hospital_name'];
            $user->department_name = $data['department_name'];
            $user->visit_type      = $data['visit_type'];
            $user->name            = $data['name'];
            $user->gender          = $data['gender'];
            $user->age             = $data['age'];
            $user->is_archived     = 1;
            $user->enroll_date     = $user->enroll_date ?: date('Y-m-d');
            $user->save();
            Db::commit();
        } catch (\Throwable $exception) {
            Db::rollBack();
            throw new ServiceException('用户信息保存失败');
        }

        return $this->getDetail($userId);
    }

    public function saveReminderSetting(int $userId, array $data): array
    {
        $user = UserModel::query()->find($userId);
        if (!$user) {
            throw new ServiceException('用户不存在');
        }

        try {
            $user->reminder_setting = json_encode([
                'breakfast_time' => $data['breakfast_time'],
                'lunch_time'     => $data['lunch_time'],
                'dinner_time'    => $data['dinner_time'],
                'sleep_time'     => $data['sleep_time'],
            ], JSON_UNESCAPED_UNICODE);
            $user->save();
        } catch (\Throwable $exception) {
            throw new ServiceException('提醒设置保存失败');
        }

        return $this->getReminderSetting($userId);
    }

    public function saveMedicines(int $userId, array $medicines): array
    {
        $this->assertUserExists($userId);

        Db::beginTransaction();
        try {
            $batchNo               = $this->generateBatchNo($userId);
            $existingMedicineCount = UserMedicineModel::query()->where('user_id', $userId)->count();
            foreach ($medicines as $index => $medicine) {
                $medicine        = $this->normalizeMedicinePayload($medicine);
                $createdMedicine = UserMedicineModel::query()->create([
                    'user_id'        => $userId,
                    'name'           => $medicine['name'],
                    'specification'  => $medicine['specification'] ?? '',
                    'usage'          => $medicine['usage'] ?? '',
                    'frequency'      => $medicine['frequency'] ?? 1,
                    'dosage'         => $medicine['dosage'] ?? '',
                    'dosage_value'   => $medicine['dosage_value'] ?? '',
                    'dosage_unit'    => $medicine['dosage_unit'] ?? '',
                    'remark'         => $medicine['remark'] ?? '',
                    'trade_name'     => $medicine['trade_name'] ?? '',
                    'company'        => $medicine['company'] ?? '',
                    'medicine_count' => $medicine['medicine_count'] ?? '',
                    'ybm'            => $medicine['ybm'] ?? '',
                    'thumb'          => $medicine['thumb'] ?? '',
                    'batch_no'       => $batchNo,
                    'sort'           => $existingMedicineCount + $index + 1,
                    'source'         => $medicine['source'] ?? 'manual',
                ]);
                $this->createMedicationPlansForMedicine($userId, $createdMedicine);
            }
            Db::commit();
        } catch (\Throwable $exception) {
            Db::rollBack();
            throw new ServiceException('药品添加失败');
        }

        return $this->getUserMedicines($userId);
    }

    public function updateMedicine(int $userId, int $medicineId, array $data): array
    {
        $medicine = $this->getOwnedMedicine($userId, $medicineId);
        Db::beginTransaction();
        try {
            $data                     = $this->normalizeMedicinePayload($data);
            $medicine->name           = $data['name'];
            $medicine->specification  = $data['specification'] ?? '';
            $medicine->usage          = $data['usage'] ?? '';
            $medicine->frequency      = $data['frequency'] ?? 1;
            $medicine->dosage         = $data['dosage'] ?? '';
            $medicine->dosage_value   = $data['dosage_value'] ?? '';
            $medicine->dosage_unit    = $data['dosage_unit'] ?? '';
            $medicine->remark         = $data['remark'] ?? '';
            $medicine->trade_name     = $data['trade_name'] ?? '';
            $medicine->company        = $data['company'] ?? '';
            $medicine->medicine_count = $data['medicine_count'] ?? '';
            $medicine->ybm            = $data['ybm'] ?? '';
            $medicine->thumb          = $data['thumb'] ?? '';
            $medicine->save();
            $this->syncFutureMedicationPlans($userId, $medicine);
            Db::commit();
        } catch (\Throwable $exception) {
            Db::rollBack();
            throw new ServiceException('药品修改失败');
        }
        return $this->getUserMedicines($userId);
    }

    public function checkMedicationPlan(int $userId, int $planId): array
    {
        $this->assertUserExists($userId);

        $plan = UserMedicationPlanModel::query()
            ->where('id', $planId)
            ->where('user_id', $userId)
            ->first();
        if (!$plan) {
            throw new ServiceException('用药计划不存在');
        }

        $today = date('Y-m-d');
        if ((string)$plan->plan_date !== $today) {
            throw new ServiceException('仅支持当天用药计划打卡');
        }
        if ((int)$plan->status === 1) {
            throw new ServiceException('该计划已打卡');
        }

        try {
            $plan->status     = 1;
            $plan->checked_at = date('Y-m-d H:i:s');
            $plan->save();
        } catch (\Throwable $exception) {
            throw new ServiceException('打卡失败');
        }

        return $this->getTodayMedicationPlans($userId);
    }

    public function recognizePrescription(string $image): array
    {
        $imageData = $this->fileService->uploadBase64($image);
        $imageUrl  = $imageData['url'] ?? '';
        if ($imageUrl === '') {
            throw new ServiceException('图片上传错误，请稍后再试');
        }
        $result = $this->aliDifyService->ocr($imageUrl);
        return [
            'url'       => $imageUrl,
            'medicines' => $this->normalizeRecognizedMedicines($result ?? []),
        ];
    }

    private function visitTypeText(int $visitType): string
    {
        return match ($visitType) {
            1 => '门诊患者',
            2 => '住院患者',
            default => '',
        };
    }

    private function getUserMedicines(int $userId): array
    {
        $medicines = UserMedicineModel::query()
            ->where('user_id', $userId)
            ->orderBy('id', 'desc')
            ->get([
                'id',
                'name',
                'specification',
                'usage',
                'frequency',
                'dosage',
                'dosage_value',
                'dosage_unit',
                'remark',
                'trade_name',
                'company',
                'medicine_count',
                'ybm',
                'thumb',
                'batch_no',
                'sort',
                'source',
            ]);

        $ybms = $medicines->pluck('ybm')
            ->filter(fn($ybm) => trim((string)$ybm) !== '')
            ->map(fn($ybm) => trim((string)$ybm))
            ->unique()
            ->values()
            ->all();

        $guidanceMap = [];
        if (!empty($ybms)) {
            $guidanceMap = CommonMedicineModel::query()
                ->whereIn('ybm', $ybms)
                ->get(['ybm', 'medication_guidance'])
                ->filter(fn($item) => trim((string)$item->ybm) !== '')
                ->mapWithKeys(fn($item) => [
                    trim((string)$item->ybm) => (string)($item->medication_guidance ?? ''),
                ])
                ->toArray();
        }

        return $medicines->map(fn($item) => [
                'id'             => (int)$item->id,
                'name'           => (string)$item->name,
                'specification'  => (string)$item->specification,
                'usage'          => (string)$item->usage,
                'frequency'      => (int)$item->frequency,
                'dosage'         => (string)$item->dosage,
                'dosage_value'   => (string)($item->dosage_value ?? ''),
                'dosage_unit'    => (string)($item->dosage_unit ?? ''),
                'remark'         => (string)$item->remark,
                'trade_name'     => (string)$item->trade_name,
                'company'        => (string)$item->company,
                'medicine_count' => (string)$item->medicine_count,
                'ybm'            => (string)$item->ybm,
                'thumb'          => (string)$item->thumb,
                'batch_no'       => (string)$item->batch_no,
                'sort'           => (int)$item->sort,
                'source'         => (string)$item->source,
                'medication_guidance' => $guidanceMap[trim((string)$item->ybm)] ?? '',
            ])->toArray();
    }

    public function normalizeRecognizedMedicines(mixed $data): array
    {
        if (!is_array($data)) {
            return [];
        }

        $list = $data['medicines'] ?? $data['list'] ?? $data['drugList'] ?? $data;
        if (!is_array($list)) {
            return [];
        }

        $recognizedItems = [];
        foreach ($list as $item) {
            $item = $this->pickRecognizedMedicineItem($item);
            if (!is_array($item)) {
                continue;
            }
            $name = trim((string)($item['name'] ?? $item['drug_name'] ?? $item['medicine_name'] ?? ''));
            if ($name === '') {
                $name = trim((string)($item['commonName'] ?? $item['tradeName'] ?? ''));
            }
            if ($name === '') {
                continue;
            }

            $recognizedItems[] = [
                'name' => $name,
                'specification' => trim((string)($item['specification'] ?? $item['spec'] ?? '')),
                'usage_text' => trim((string)($item['usage'] ?? $item['method'] ?? '')),
                'frequency_text' => trim((string)($item['frequency'] ?? '')),
                'dosage_text' => trim((string)($item['dosage'] ?? $item['dose'] ?? '')),
                'medicine_count' => trim((string)($item['medicineCount'] ?? '')),
                'trade_name' => trim((string)($item['tradeName'] ?? '')),
                'company' => trim((string)($item['company'] ?? '')),
                'ybm' => trim((string)($item['ybm'] ?? $item['drug_code'] ?? '')),
                'thumb' => trim((string)($item['thumb'] ?? $item['image'] ?? $item['img'] ?? '')),
                'remark' => trim((string)($item['remark'] ?? '')),
            ];
        }

        if (empty($recognizedItems)) {
            return [];
        }

        $aiMap  = $this->enhanceRecognizedMedicinesWithAi($recognizedItems);
        $result = [];
        foreach ($recognizedItems as $index => $item) {
            $aiItem = $aiMap[$index] ?? [];

            $parsedUsage     = $this->parseRecognizedUsage((string)$item['usage_text']);
            $parsedFrequency = $this->splitFrequencyCount((string)($item['frequency_text'] ?: $parsedUsage['frequency']));
            $parsedDosage    = $this->splitDosageFields((string)($item['dosage_text'] ?: $parsedUsage['dosage']));

            $usage = trim((string)($aiItem['usage'] ?? ''));
            if ($usage === '') {
                $usage = $parsedUsage['usage'];
            }

            $frequency = (int)($aiItem['frequency'] ?? 0);
            if ($frequency <= 0) {
                $frequency = $parsedFrequency;
            }

            $dosageText = trim((string)($aiItem['dosage'] ?? ''));
            $dosageValue = trim((string)($aiItem['dosage_value'] ?? ''));
            $dosageUnit  = trim((string)($aiItem['dosage_unit'] ?? ''));
            if ($dosageText === '' && $dosageValue !== '' && $dosageUnit !== '') {
                $dosageText = $dosageValue . $dosageUnit;
            }
            if ($dosageText === '') {
                $dosageText  = $parsedDosage['text'];
                $dosageValue = $parsedDosage['value'];
                $dosageUnit  = $parsedDosage['unit'];
            } else {
                $parsedAiDosage = $this->splitDosageFields($dosageText);
                if ($dosageValue === '') {
                    $dosageValue = $parsedAiDosage['value'];
                }
                if ($dosageUnit === '') {
                    $dosageUnit = $parsedAiDosage['unit'];
                }
            }

            $result[] = [
                'name'           => $item['name'],
                'specification'  => $item['specification'],
                'usage'          => $usage,
                'frequency'      => $frequency,
                'dosage'         => $dosageText,
                'dosage_value'   => $dosageValue,
                'dosage_unit'    => $dosageUnit,
                'remark'         => $item['remark'],
                'trade_name'     => $item['trade_name'],
                'company'        => $item['company'],
                'medicine_count' => $item['medicine_count'],
                'ybm'            => $item['ybm'],
                'thumb'          => $item['thumb'],
                'source'         => 'ocr',
            ];
        }

        return $result;
    }

    private function enhanceRecognizedMedicinesWithAi(array $recognizedItems): array
    {
        if (empty($recognizedItems)) {
            return [];
        }

        $payload = [];
        foreach ($recognizedItems as $index => $item) {
            $payload[] = [
                'index' => $index,
                'name' => $item['name'] ?? '',
                'trade_name' => $item['trade_name'] ?? '',
                'specification' => $item['specification'] ?? '',
                'usage_text' => $item['usage_text'] ?? '',
                'frequency_text' => $item['frequency_text'] ?? '',
                'dosage_text' => $item['dosage_text'] ?? '',
                'medicine_count' => $item['medicine_count'] ?? '',
            ];
        }

        $systemPrompt = <<<PROMPT
你是药品处方结构化助手。请根据 OCR 识别出的药品信息，提取并标准化每个药品的以下字段：
1. usage：用法，如口服、外用、注射、静滴、雾化等。
2. frequency：每日用药频次，必须输出阿拉伯数字整数，例如 1、2、3。无法确认时输出 0。
3. dosage：单次用量完整文本，例如 50mg、1片、0.5mg。
4. dosage_value：单次用量中的数量部分，例如 50、1、0.5。
5. dosage_unit：单次用量中的单位部分，例如 mg、片、粒、ml。

规则：
- 重点依据 usage_text、frequency_text、dosage_text、medicine_count、specification 综合判断。
- 如果 usage_text 里出现“每天三次，每次50mg，口服，24天”这类文本，要拆解出 usage=口服，frequency=3，dosage=50mg，dosage_value=50，dosage_unit=mg。
- 不要把疗程天数、盒数、片数/盒 误识别为 frequency 或 dosage。
- frequency 只能是每天次数，不是总天数，不是总盒数。
- 如果 dosage_value 和 dosage_unit 能判断，则 dosage 也要同时给出。
- 只返回 JSON 数组，不要输出任何解释、Markdown 或代码块。
- JSON 数组中的每一项必须包含 index、usage、frequency、dosage、dosage_value、dosage_unit。
PROMPT;

        $userContent = json_encode($payload, JSON_UNESCAPED_UNICODE);
        if ($userContent === false || $userContent === '') {
            return [];
        }

        try {
            $text = $this->aliBaiLianService->query($systemPrompt, $userContent);
            if ($text === '') {
                return [];
            }

            $json = $this->extractJsonArrayOrObject($text);
            $decoded = json_decode($json, true);
            if (!is_array($decoded)) {
                Log::warning('OCR 药品结构化 AI 返回非 JSON', ['text' => $text]);
                return [];
            }

            $items = $this->isAssocArray($decoded) ? [$decoded] : $decoded;
            $result = [];
            foreach ($items as $row) {
                if (!is_array($row)) {
                    continue;
                }
                $index = isset($row['index']) ? (int)$row['index'] : -1;
                if ($index < 0) {
                    continue;
                }
                $result[$index] = [
                    'usage' => trim((string)($row['usage'] ?? '')),
                    'frequency' => max(0, (int)($row['frequency'] ?? 0)),
                    'dosage' => trim((string)($row['dosage'] ?? '')),
                    'dosage_value' => trim((string)($row['dosage_value'] ?? '')),
                    'dosage_unit' => trim((string)($row['dosage_unit'] ?? '')),
                ];
            }
            return $result;
        } catch (\Throwable $exception) {
            Log::warning('OCR 药品结构化 AI 调用失败', ['error' => $exception->getMessage()]);
            return [];
        }
    }

    private function normalizeMedicinePayload(array $medicine): array
    {
        $medicine['frequency'] = isset($medicine['frequency']) ? (int)$medicine['frequency'] : 1;
        if ($medicine['frequency'] <= 0) {
            $medicine['frequency'] = $this->splitFrequencyCount((string)($medicine['frequency'] ?? ''));
        }
        if ($medicine['frequency'] <= 0) {
            $medicine['frequency'] = 1;
        }

        $medicine['dosage_value'] = trim((string)($medicine['dosage_value'] ?? ''));
        $medicine['dosage_unit']  = trim((string)($medicine['dosage_unit'] ?? ''));
        if ($medicine['dosage_value'] === '' || $medicine['dosage_unit'] === '') {
            $parsedDosage = $this->splitDosageFields((string)($medicine['dosage'] ?? ''));
            if ($medicine['dosage_value'] === '') {
                $medicine['dosage_value'] = $parsedDosage['value'];
            }
            if ($medicine['dosage_unit'] === '') {
                $medicine['dosage_unit'] = $parsedDosage['unit'];
            }
            if (($medicine['dosage'] ?? '') === '') {
                $medicine['dosage'] = $parsedDosage['text'];
            }
        } else {
            $medicine['dosage'] = $medicine['dosage_value'] . $medicine['dosage_unit'];
        }
        return $medicine;
    }

    private function splitFrequencyCount(string $frequencyText): int
    {
        $frequencyText = trim($frequencyText);
        if ($frequencyText === '') {
            return 0;
        }

        if (preg_match('/(\d+)/', $frequencyText, $matches)) {
            return (int)$matches[1];
        }

        $normalized = $this->normalizeNumberString($frequencyText);
        return ctype_digit($normalized) ? (int)$normalized : 0;
    }

    private function splitDosageFields(string $dosageText): array
    {
        $dosageText = trim($dosageText);
        if ($dosageText === '') {
            return ['text' => '', 'value' => '', 'unit' => ''];
        }
        if (preg_match('/^([0-9]+(?:\.[0-9]+)?)\s*([^\d\s]+)$/u', $dosageText, $matches)) {
            return [
                'text'  => $matches[1] . $matches[2],
                'value' => $matches[1],
                'unit'  => $matches[2],
            ];
        }
        return ['text' => $dosageText, 'value' => '', 'unit' => ''];
    }

    private function normalizeNumberString(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }
        if (preg_match('/^\d+$/', $value)) {
            return $value;
        }
        $map = [
            '一' => 1,
            '二' => 2,
            '两' => 2,
            '三' => 3,
            '四' => 4,
            '五' => 5,
            '六' => 6,
            '七' => 7,
            '八' => 8,
            '九' => 9,
            '十' => 10,
        ];
        if ($value === '十') {
            return '10';
        }
        if (str_contains($value, '十')) {
            [$left, $right] = explode('十', $value, 2);
            $leftValue  = $left === '' ? 1 : ($map[$left] ?? 0);
            $rightValue = $right === '' ? 0 : ($map[$right] ?? 0);
            return (string)($leftValue * 10 + $rightValue);
        }
        return isset($map[$value]) ? (string)$map[$value] : $value;
    }

    private function pickRecognizedMedicineItem(mixed $item): mixed
    {
        if (!is_array($item)) {
            return $item;
        }
        if ($this->isAssocArray($item)) {
            return $item;
        }
        if (isset($item[0]) && is_array($item[0])) {
            return $item[0];
        }
        $bestItem  = null;
        $bestScore = null;
        foreach ($item as $candidate) {
            if (!is_array($candidate)) {
                continue;
            }
            $score = (float)($candidate['score'] ?? 0);
            if (($candidate['display'] ?? '') === '1') {
                $score += 1000;
            }
            if (($candidate['status'] ?? '') === '1') {
                $score += 100;
            }
            if ($bestItem === null || $score > $bestScore) {
                $bestItem  = $candidate;
                $bestScore = $score;
            }
        }
        return $bestItem;
    }

    private function parseRecognizedUsage(string $usageText): array
    {
        $usageText = trim($usageText);
        $result    = [
            'usage'     => $usageText,
            'frequency' => '',
            'dosage'    => '',
        ];
        if ($usageText === '') {
            return $result;
        }

        $segments = preg_split('/[，,]/u', $usageText) ?: [];
        foreach ($segments as $segment) {
            $segment = trim($segment);
            if ($segment === '') {
                continue;
            }
            if ($result['frequency'] === '' && preg_match('/^每[日天周月年]/u', $segment)) {
                $result['frequency'] = $segment;
                continue;
            }
            if ($result['dosage'] === '' && (str_contains($segment, '每次') || str_contains($segment, '一次'))) {
                $result['dosage'] = preg_replace('/^每次/u', '', $segment) ?? $segment;
                continue;
            }
            if ($result['usage'] === $usageText && preg_match('/(口服|外用|注射|静滴|静脉滴注|肌注|吸入|含服|滴眼|滴鼻|雾化|冲服)$/u', $segment)) {
                $result['usage'] = $segment;
            }
        }
        return $result;
    }

    private function extractJsonArrayOrObject(string $text): string
    {
        $text = trim($text);
        if (str_starts_with($text, '```')) {
            $text = preg_replace('/^```[a-zA-Z]*\s*/', '', $text) ?? $text;
            $text = preg_replace('/\s*```$/', '', $text) ?? $text;
            $text = trim($text);
        }

        $arrayStart = strpos($text, '[');
        $arrayEnd   = strrpos($text, ']');
        if ($arrayStart !== false && $arrayEnd !== false && $arrayEnd > $arrayStart) {
            return substr($text, $arrayStart, $arrayEnd - $arrayStart + 1);
        }

        $objectStart = strpos($text, '{');
        $objectEnd   = strrpos($text, '}');
        if ($objectStart !== false && $objectEnd !== false && $objectEnd > $objectStart) {
            return substr($text, $objectStart, $objectEnd - $objectStart + 1);
        }

        return $text;
    }

    private function isAssocArray(array $array): bool
    {
        return array_keys($array) !== range(0, count($array) - 1);
    }

    private function createMedicationPlansForMedicine(int $userId, UserMedicineModel $medicine): void
    {
        $totalDays = $this->getMedicationPlanDays();
        $today     = new \DateTimeImmutable('today');
        $planTimes = $this->resolvePlanTimes($userId, (int)$medicine->frequency);
        for ($day = 1; $day <= $totalDays; $day++) {
            $planDate = $today->modify('+' . ($day - 1) . ' day')->format('Y-m-d');
            foreach ($planTimes as $index => $planTime) {
                UserMedicationPlanModel::query()->create([
                    'user_id'       => $userId,
                    'medicine_id'   => $medicine->id,
                    'plan_date'     => $planDate,
                    'day_number'    => $day,
                    'plan_time'     => $planTime,
                    'plan_index'    => $index + 1,
                    'name'          => $medicine->name,
                    'specification' => $medicine->specification,
                    'usage'         => $medicine->usage,
                    'frequency'     => $medicine->frequency,
                    'dosage'        => $medicine->dosage,
                    'dosage_value'  => $medicine->dosage_value,
                    'dosage_unit'   => $medicine->dosage_unit,
                    'status'        => 0,
                    'checked_at'    => null,
                ]);
            }
        }
    }

    private function syncFutureMedicationPlans(int $userId, UserMedicineModel $medicine): void
    {
        $tomorrow = (new \DateTimeImmutable('today'))->modify('+1 day')->format('Y-m-d');
        UserMedicationPlanModel::query()
            ->where('user_id', $userId)
            ->where('medicine_id', $medicine->id)
            ->where('plan_date', '>=', $tomorrow)
            ->delete();

        $totalDays = $this->getMedicationPlanDays();
        $today     = new \DateTimeImmutable('today');
        $planTimes = $this->resolvePlanTimes($userId, (int)$medicine->frequency);
        for ($day = 2; $day <= $totalDays; $day++) {
            $planDate = $today->modify('+' . ($day - 1) . ' day')->format('Y-m-d');
            foreach ($planTimes as $index => $planTime) {
                UserMedicationPlanModel::query()->create([
                    'user_id'       => $userId,
                    'medicine_id'   => $medicine->id,
                    'plan_date'     => $planDate,
                    'day_number'    => $day,
                    'plan_time'     => $planTime,
                    'plan_index'    => $index + 1,
                    'name'          => $medicine->name,
                    'specification' => $medicine->specification,
                    'usage'         => $medicine->usage,
                    'frequency'     => $medicine->frequency,
                    'dosage'        => $medicine->dosage,
                    'dosage_value'  => $medicine->dosage_value,
                    'dosage_unit'   => $medicine->dosage_unit,
                    'status'        => 0,
                    'checked_at'    => null,
                ]);
            }
        }
    }

    private function resolvePlanTimes(int $userId, int $frequency): array
    {
        $frequency = max(1, min(24, $frequency));
        $setting   = $this->getReminderSetting($userId);
        $baseTimes = array_values(array_filter([
            $setting['breakfast_time'] ?? '',
            $setting['lunch_time'] ?? '',
            $setting['dinner_time'] ?? '',
            $setting['sleep_time'] ?? '',
        ], fn($item) => $item !== ''));

        if (empty($baseTimes)) {
            $baseTimes = ['08:00', '12:00', '18:00', '21:00'];
        }

        if ($frequency === 2) {
            $breakfastTime = $setting['breakfast_time'] ?: ($baseTimes[0] ?? '08:00');
            $dinnerTime    = $setting['dinner_time'] ?: ($baseTimes[2] ?? end($baseTimes) ?: '18:00');
            return [$breakfastTime, $dinnerTime];
        }

        if ($frequency <= count($baseTimes)) {
            return array_slice($baseTimes, 0, $frequency);
        }

        $times = $baseTimes;
        while (count($times) < $frequency) {
            $times[] = end($baseTimes);
        }
        return $times;
    }

    private function getMedicationPlanDays(): int
    {
        $days = (int)config('patient.medication_plan_days', 180);
        return $days > 0 ? $days : 180;
    }

    private function assertUserExists(int $userId): void
    {
        $user = UserModel::query()->find($userId);
        if (!$user) {
            throw new ServiceException('用户不存在');
        }
    }

    private function generateBatchNo(int $userId): string
    {
        return 'MED' . $userId . date('YmdHis') . substr(str_replace('.', '', (string)microtime(true)), -4);
    }

    private function getCurrentBatchNo(int $userId): string
    {
        $batchNo = UserMedicineModel::query()
            ->where('user_id', $userId)
            ->orderByDesc('id')
            ->value('batch_no');

        return $batchNo ? (string)$batchNo : '';
    }

    private function getMedicineBatchNo(int $userId, int $medicineId): string
    {
        $batchNo = UserMedicineModel::query()
            ->where('user_id', $userId)
            ->where('id', $medicineId)
            ->value('batch_no');

        return $batchNo ? (string)$batchNo : '';
    }

    private function getOwnedMedicine(int $userId, int $medicineId): UserMedicineModel
    {
        $medicine = UserMedicineModel::query()
            ->where('id', $medicineId)
            ->where('user_id', $userId)
            ->first();
        if (!$medicine) {
            throw new ServiceException('药品不存在');
        }

        return $medicine;
    }
}
