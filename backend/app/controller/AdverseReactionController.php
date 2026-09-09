<?php

namespace app\controller;

use app\exception\ServiceException;
use app\model\UserAdverseReactionReportModel;
use app\model\UserModel;
use Respect\Validation\Exceptions\ValidationException;
use Respect\Validation\Validator as v;
use support\Request;
use support\Response;

class AdverseReactionController extends BaseController
{
    public function report(Request $request): Response
    {
        try {
            $data = v::input($request->post(), [
                'occurred_at'          => v::stringType()->regex('/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/')->setName('发生时间'),
                'symptoms'             => v::arrayType()->length(1, null)->setName('主要症状'),
                'symptom_description'  => v::oneOf(v::nullType(), v::stringType()->length(0, 1000))->setName('症状描述'),
                'severity'             => v::intVal()->in([1, 2, 3])->setName('严重程度'),
            ]);
        } catch (ValidationException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }

        foreach ($data['symptoms'] as $index => $symptom) {
            if (!is_string($symptom) || trim($symptom) === '' || mb_strlen($symptom) > 50) {
                return json(['code' => 1, 'data' => [], 'message' => '第' . ($index + 1) . '个症状格式不正确']);
            }
        }

        $user = UserModel::query()->find($this->id());
        if (!$user) {
            return json(['code' => 1, 'data' => [], 'message' => '用户不存在']);
        }

        [$severityText, $adviceText] = $this->buildSeverityInfo((int)$data['severity']);

        try {
            $report = UserAdverseReactionReportModel::query()->create([
                'user_id'              => $this->id(),
                'occurred_at'          => $data['occurred_at'],
                'symptoms'             => json_encode(array_values($data['symptoms']), JSON_UNESCAPED_UNICODE),
                'symptom_description'  => $data['symptom_description'] ?? '',
                'severity'             => (int)$data['severity'],
                'severity_text'        => $severityText,
                'advice_text'          => $adviceText,
                'status'               => 1,
            ]);
        } catch (\Throwable $exception) {
            return json(['code' => 1, 'data' => [], 'message' => '上报失败']);
        }

        return json([
            'code' => 0,
            'data' => $this->formatReport($report),
            'message' => '上报成功',
        ]);
    }

    public function reportList(): Response
    {
        $list = UserAdverseReactionReportModel::query()
            ->where('user_id', $this->id())
            ->orderByDesc('id')
            ->get()
            ->map(fn($item) => $this->formatReport($item))
            ->toArray();

        return json(['code' => 0, 'data' => $list, 'message' => '获取成功']);
    }

    private function formatReport(UserAdverseReactionReportModel $report): array
    {
        $symptoms = json_decode($report->symptoms, true);
        return [
            'id'                  => $report->id,
            'occurred_at'         => $report->occurred_at,
            'symptoms'            => is_array($symptoms) ? $symptoms : [],
            'symptom_description' => $report->symptom_description,
            'severity'            => $report->severity,
            'severity_text'       => $report->severity_text,
            'advice_text'         => $report->advice_text,
            'status'              => $report->status,
            'created_at'          => $report->created_at ? $report->created_at : '',
        ];
    }

    private function buildSeverityInfo(int $severity): array
    {
        return match ($severity) {
            1 => ['轻度', '症状较轻，可先继续观察并按要求上报；如症状加重或持续不缓解，请及时联系随访医生。'],
            2 => ['中度', '症状已影响吃饭、睡觉或日常活动，请尽快联系随访医生，由医生判断是否需要检查或调整用药。'],
            3 => ['重度', '您选择的症状较为严重，请立即停药并前往医院就诊。请勿等待在线回复。'],
            default => throw new ServiceException('严重程度不正确'),
        };
    }
}
