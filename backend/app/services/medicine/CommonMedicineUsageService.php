<?php

namespace app\services\medicine;

use app\model\CommonMedicineModel;
use app\model\InsertMedicinesInfoModel;
use app\model\InsertMedicinesInstructionModel;
use support\Log;

class CommonMedicineUsageService
{
    private string $appId;

    private string $host;

    private string $apiKey;

    public function __construct()
    {
        $this->appId = 'ecd5c0e73b9b463cba6325ff4bfdce87';
        $this->host = 'https://dashscope.aliyuncs.com/api/v1/apps/';
        $this->apiKey = 'sk-ead382075568407e9a600501fbc7a0b7';
    }

    /**
     * @throws \RuntimeException
     */
    public function generateAndSave(int $commonMedicineId, bool $force = false): array
    {
        $medicine = CommonMedicineModel::query()->find($commonMedicineId);
        if (!$medicine) {
            throw new \RuntimeException("常用药不存在，ID: {$commonMedicineId}");
        }

        if (!$force && $this->hasUsageFields($medicine)) {
            return [
                'id' => (int)$medicine->id,
                'status' => 'skipped',
                'message' => '已存在用法用量字段，跳过',
            ];
        }

        $commonName = trim((string)$medicine->common_name);
        $ybm = trim((string)$medicine->ybm);
        $specification = trim((string)$medicine->specification);
        if ($commonName === '' && $ybm === '') {
            throw new \RuntimeException("常用药缺少 common_name 和 ybm，ID: {$commonMedicineId}");
        }

        $instructionContext = $this->buildInstructionContextByYbm($ybm);
        $prompt = <<<PROMPT
请根据药品信息提取并推断以下字段，返回 JSON：
- usage: 服用方式，例如“口服”“外用”“餐后口服”
- frequency: 每天服药几次，必须是整数，例如一日1次=1、一日2次=2、一日3次=3
- dosage: 每次剂量完整描述，例如“1片”“0.5g”“10ml”
- dosage_value: 每次剂量中的数量部分，例如“1”“0.5”“10”
- dosage_unit: 每次剂量中的单位部分，例如“片”“g”“ml”

要求：
1. 只返回 JSON，不要 Markdown，不要解释。
2. JSON key 固定为 usage、frequency、dosage、dosage_value、dosage_unit。
3. 如果无法确定，字符串字段返回空字符串，frequency 返回 1。
4. 优先依据说明书中的用法用量字段，不要编造复杂内容。
5. frequency 表示每天服药次数，不是疗程天数，不是总次数，不是每周次数。
6. 如果 dosage 有值，必须尽量同时拆出 dosage_value 和 dosage_unit。
7. 例如 dosage=“1片”时，dosage_value=“1”，dosage_unit=“片”；dosage=“0.5g”时，dosage_value=“0.5”，dosage_unit=“g”。
8. 如果说明书给的是区间或按体重剂量，也可以直接返回，例如 dosage=“15～30mg/kg”，dosage_value=“15～30”，dosage_unit=“mg/kg”。

药品信息：
- 通用名：{$commonName}
- 医保码：{$ybm}
- 规格：{$specification}
PROMPT;
        if ($instructionContext !== '') {
            $prompt .= "\n- 说明书信息：\n" . $instructionContext;
        }

        $result = $this->requestAppCompletion([
            'input' => [
                'prompt' => $prompt,
                'biz_params' => [
                    'commonName' => $commonName,
                    'ybm' => $ybm,
                    'specification' => $specification,
                    'hospitalName' => '北京胸科医院',
                ],
                'session_id' => 'common-medicine-usage-' . $commonMedicineId,
            ],
            'parameters' => [
                'flow_stream_mode' => 'message_format',
            ],
        ]);

        $payload = $this->extractUsagePayload($result);
        $payload = $this->fillUsageFallback($payload, $commonName, $specification, $instructionContext === '');
        $medicine->usage = $payload['usage'];
        $medicine->frequency = $payload['frequency'];
        $medicine->dosage = $payload['dosage'];
        $medicine->dosage_value = $payload['dosage_value'];
        $medicine->dosage_unit = $payload['dosage_unit'];
        $medicine->save();

        Log::info('常用药用法用量保存成功', [
            'common_medicine_id' => $medicine->id,
            'payload' => $payload,
        ]);

        return [
            'id' => (int)$medicine->id,
            'status' => 'saved',
            'message' => '保存成功',
        ] + $payload;
    }

    private function hasUsageFields(CommonMedicineModel $medicine): bool
    {
        return trim((string)$medicine->usage) !== ''
            || (int)$medicine->frequency > 1
            || trim((string)$medicine->dosage) !== ''
            || trim((string)$medicine->dosage_value) !== ''
            || trim((string)$medicine->dosage_unit) !== '';
    }

    private function buildInstructionContextByYbm(string $ybm): string
    {
        $ybm = trim($ybm);
        if ($ybm === '') {
            return '';
        }

        $medicineInfo = InsertMedicinesInfoModel::query()
            ->where('ybm', $ybm)
            ->first(['medicine_instruction_id']);
        if (!$medicineInfo) {
            return '';
        }

        $instructionId = (int)$medicineInfo->medicine_instruction_id;
        if ($instructionId <= 0) {
            return '';
        }

        $instruction = InsertMedicinesInstructionModel::query()->find($instructionId);
        if (!$instruction) {
            return '';
        }

        $parts = [];
        $fields = [
            'dosage' => '用法用量',
            'precaution' => '注意事项',
            'indication' => '适应症',
            'warnings' => '警告',
        ];

        foreach ($fields as $field => $label) {
            $value = trim(strip_tags((string)($instruction->$field ?? '')));
            if ($value !== '') {
                $parts[] = $label . '：' . $value;
            }
        }

        return implode("\n", $parts);
    }

    /**
     * @throws \RuntimeException
     */
    private function extractUsagePayload(array $result): array
    {
        $text = $this->extractAppText($result);
        if ($text === '') {
            throw new \RuntimeException('AI 返回内容为空');
        }

        $json = $this->extractJson($text);
        $payload = json_decode($json, true);
        if (!is_array($payload)) {
            throw new \RuntimeException('AI 返回内容不是合法 JSON: ' . $text);
        }

        $normalized = [
            'usage' => trim((string)($payload['usage'] ?? '')),
            'frequency' => max(1, (int)($payload['frequency'] ?? 1)),
            'dosage' => trim((string)($payload['dosage'] ?? '')),
            'dosage_value' => trim((string)($payload['dosage_value'] ?? '')),
            'dosage_unit' => trim((string)($payload['dosage_unit'] ?? '')),
        ];

        if ($normalized['dosage'] !== '' && ($normalized['dosage_value'] === '' || $normalized['dosage_unit'] === '')) {
            $parsed = $this->parseDosage($normalized['dosage']);
            if ($normalized['dosage_value'] === '') {
                $normalized['dosage_value'] = $parsed['value'];
            }
            if ($normalized['dosage_unit'] === '') {
                $normalized['dosage_unit'] = $parsed['unit'];
            }
        }

        if ($normalized['dosage'] === '' && $normalized['dosage_value'] !== '' && $normalized['dosage_unit'] !== '') {
            $normalized['dosage'] = $normalized['dosage_value'] . $normalized['dosage_unit'];
        }

        return $normalized;
    }

    private function fillUsageFallback(array $payload, string $commonName, string $specification, bool $noInstruction): array
    {
        if ($payload['usage'] === '') {
            $payload['usage'] = $this->guessUsage($commonName);
        }

        if ($noInstruction && $payload['dosage'] === '') {
            $fromSpec = $this->parseDosageFromSpecification($specification);
            if ($fromSpec['dosage'] !== '') {
                $payload['dosage'] = $fromSpec['dosage'];
                if ($payload['dosage_value'] === '') {
                    $payload['dosage_value'] = $fromSpec['dosage_value'];
                }
                if ($payload['dosage_unit'] === '') {
                    $payload['dosage_unit'] = $fromSpec['dosage_unit'];
                }
            }
        }

        if ($payload['dosage'] === '' && $payload['dosage_value'] !== '' && $payload['dosage_unit'] !== '') {
            $payload['dosage'] = $payload['dosage_value'] . $payload['dosage_unit'];
        }

        return $payload;
    }

    private function guessUsage(string $commonName): string
    {
        $name = trim($commonName);
        if ($name === '') {
            return '';
        }

        if (preg_match('/片|胶囊|颗粒|散|丸|口服液|糖浆|混悬液/u', $name)) {
            return '口服';
        }
        if (preg_match('/注射液|针/u', $name)) {
            return '注射';
        }
        if (preg_match('/乳膏|软膏|凝胶|搽剂|喷雾剂|贴膏|贴剂/u', $name)) {
            return '外用';
        }
        if (preg_match('/滴眼液/u', $name)) {
            return '滴眼';
        }
        if (preg_match('/滴鼻液|喷鼻/u', $name)) {
            return '鼻用';
        }

        return '';
    }

    private function parseDosageFromSpecification(string $specification): array
    {
        $specification = trim($specification);
        if ($specification === '') {
            return ['dosage' => '', 'dosage_value' => '', 'dosage_unit' => ''];
        }

        if (preg_match('/([0-9]+(?:\.[0-9]+)?(?:\s*[~\-～至]\s*[0-9]+(?:\.[0-9]+)?)?)\s*(mg\/kg|g\/kg|mg|g|ml|mL|IU|片|粒|袋|丸|支|揿|滴|贴|喷|枚)/iu', $specification, $matches)) {
            $value = preg_replace('/\s+/', '', trim($matches[1])) ?? trim($matches[1]);
            $unit = trim($matches[2]);
            return [
                'dosage' => $value . $unit,
                'dosage_value' => $value,
                'dosage_unit' => $unit,
            ];
        }

        return ['dosage' => '', 'dosage_value' => '', 'dosage_unit' => ''];
    }

    private function parseDosage(string $dosage): array
    {
        $dosage = trim($dosage);
        if ($dosage === '') {
            return ['value' => '', 'unit' => ''];
        }

        if (preg_match('/^\s*([0-9]+(?:\.[0-9]+)?(?:\s*[~\-～至]\s*[0-9]+(?:\.[0-9]+)?)?(?:\/[0-9]+(?:\.[0-9]+)?)?)\s*([^\d\s]+.*)$/u', $dosage, $matches)) {
            return [
                'value' => preg_replace('/\s+/', '', trim($matches[1])) ?? trim($matches[1]),
                'unit' => trim($matches[2]),
            ];
        }

        if (preg_match('/^\s*([半一二三四五六七八九十两]+)\s*([^\d\s]+.*)$/u', $dosage, $matches)) {
            return [
                'value' => trim($matches[1]),
                'unit' => trim($matches[2]),
            ];
        }

        if (preg_match('/([0-9]+(?:\.[0-9]+)?(?:\s*[~\-～至]\s*[0-9]+(?:\.[0-9]+)?)?)\s*(mg\/kg|g\/kg|mg|g|ml|mL|IU|片|粒|袋|丸|支|揿|滴|贴|喷|枚|瓶)/iu', $dosage, $matches)) {
            return [
                'value' => preg_replace('/\s+/', '', trim($matches[1])) ?? trim($matches[1]),
                'unit' => trim($matches[2]),
            ];
        }

        return ['value' => '', 'unit' => ''];
    }

    private function extractJson(string $text): string
    {
        $text = trim($text);
        if (str_starts_with($text, '```')) {
            $text = preg_replace('/^```[a-zA-Z]*\s*/', '', $text) ?? $text;
            $text = preg_replace('/\s*```$/', '', $text) ?? $text;
            $text = trim($text);
        }

        $start = strpos($text, '{');
        $end = strrpos($text, '}');
        if ($start === false || $end === false || $end <= $start) {
            return $text;
        }

        return substr($text, $start, $end - $start + 1);
    }

    private function extractAppText(array $result): string
    {
        $candidates = [
            $result['output']['text'] ?? '',
            $result['output']['message']['content'] ?? '',
            $result['output']['workflow_output']['text'] ?? '',
            $result['output']['workflow_output'] ?? '',
            $result['output']['workflow_message']['message']['content'] ?? '',
        ];

        foreach ($candidates as $candidate) {
            $text = $this->normalizeText($candidate);
            if ($text !== '') {
                return $text;
            }
        }

        return '';
    }

    private function normalizeText(mixed $content): string
    {
        if (is_string($content)) {
            return trim($content);
        }

        if (!is_array($content)) {
            return '';
        }

        if (isset($content['content']) && is_string($content['content'])) {
            return trim($content['content']);
        }

        $texts = [];
        foreach ($content as $item) {
            if (is_string($item)) {
                $texts[] = $item;
                continue;
            }
            if (($item['type'] ?? '') === 'text' && !empty($item['text'])) {
                $texts[] = (string)$item['text'];
            }
        }

        return trim(implode("\n", $texts));
    }

    /**
     * @throws \RuntimeException
     */
    private function requestAppCompletion(array $payload): array
    {
        $ch = curl_init($this->host . $this->appId . '/completion');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->apiKey,
            ],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT => 120,
        ]);

        $response = curl_exec($ch);
        $errno = curl_errno($ch);
        $error = curl_error($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($errno !== 0) {
            throw new \RuntimeException('请求百炼接口失败: ' . $error);
        }

        if (!is_string($response) || $response === '') {
            throw new \RuntimeException('请求百炼接口失败: 返回内容为空');
        }

        $result = json_decode($response, true);
        if (!is_array($result)) {
            throw new \RuntimeException('请求百炼接口失败: 返回内容不是合法 JSON');
        }

        if ($httpCode >= 400 || isset($result['error'])) {
            $message = $result['error']['message'] ?? $result['message'] ?? ('HTTP ' . $httpCode);
            throw new \RuntimeException('请求百炼接口失败: ' . $message);
        }

        return $result;
    }
}
