<?php

namespace app\services\medicine;

use app\model\CommonMedicineModel;
use app\model\InsertMedicinesInfoModel;
use app\model\InsertMedicinesInstructionModel;
use support\Log;

class MedicineGuidanceService
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

        if (!$force && !empty($medicine->medication_guidance)) {
            return [
                'id' => (int)$medicine->id,
                'status' => 'skipped',
                'message' => '已存在用药指导，跳过',
                'medication_guidance' => (string)$medicine->medication_guidance,
            ];
        }

        $commonName = trim((string)$medicine->common_name);
        $ybm = trim((string)$medicine->ybm);
        if ($commonName === '' && $ybm === '') {
            throw new \RuntimeException("常用药缺少 commonName 和 ybm，ID: {$commonMedicineId}");
        }

        $instructionContext = $this->buildInstructionContextByYbm($ybm);
        $prompt = '请生成该药品的简短用药指导。';
        $prompt .= "\n要求：";
        $prompt .= "\n1. 只保留患者最需要知道的 3-5 条要点。";
        $prompt .= "\n2. 每条一句话，尽量控制在 20 字以内。";
        $prompt .= "\n3. 优先写服用方法、关键注意事项、需要警惕的不良反应。";
        $prompt .= "\n4. 不要解释原理，不要复述说明书，不要写空泛套话。";
        $prompt .= "\n5. 不要出现“请遵医嘱”“详见说明书”等结尾套话。";
        $prompt .= "\n6. 直接返回要点列表，不要写标题和开场白。";
        if ($instructionContext !== '') {
            $prompt .= "\n\n补充说明书信息：\n" . $instructionContext;
        }

        $result = $this->requestAppCompletion([
            'input' => [
                'prompt' => $prompt,
                'biz_params' => [
                    'commonName' => $commonName,
                    'ybm' => $ybm,
                    'hospitalName' => '北京胸科医院'
                ],
                'session_id' => 'common-medicine-guidance-' . $commonMedicineId,
            ],
            'parameters' => [
                'flow_stream_mode' => 'message_format',
            ],
        ]);

        $guidance = $this->extractAppText($result);
        if ($guidance === '') {
            Log::error('用药指导生成结果为空', [
                'common_medicine_id' => $commonMedicineId,
                'result' => $result,
            ]);
            throw new \RuntimeException("用药指导生成失败，返回内容为空，ID: {$commonMedicineId}");
        }

        $medicine->medication_guidance = $guidance;
        $medicine->save();

        Log::info('用药指导保存成功', [
            'common_medicine_id' => $medicine->id,
        ]);

        return [
            'id' => (int)$medicine->id,
            'status' => 'saved',
            'message' => '保存成功',
            'medication_guidance' => $guidance,
        ];
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
            'adverseReaction' => '不良反应',
            'precaution' => '注意事项',
            'contraindication' => '禁忌症',
            'interaction' => '药物相互作用',
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
