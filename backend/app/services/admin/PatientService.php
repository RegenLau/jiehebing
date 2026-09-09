<?php

namespace app\services\admin;

use app\model\CommonMedicineModel;
use app\model\SurveyAnswerModel;
use app\model\SurveyOptionModel;
use app\model\SurveyQuestionModel;
use app\model\SurveyTemplateModel;
use app\model\UserMedicineModel;
use app\model\UserModel;

class PatientService
{
    public function getList(int $current, int $size): array
    {
        $paginator = UserModel::query()
            ->orderByDesc('id')
            ->paginate(
                $size,
                [
                    'id',
                    'name',
                    'mobile',
                    'gender',
                    'age',
                    'hospital_name',
                    'department_name',
                    'visit_type',
                    'is_archived',
                    'enroll_date',
                    'status',
                    'created_at',
                    'updated_at',
                ],
                'current',
                $current
            );

        $list = collect($paginator->items())
            ->map(function (UserModel $user) {
                return [
                    'id'              => (int)$user->id,
                    'name'            => (string)($user->name ?? ''),
                    'mobile'          => (string)($user->mobile ?? ''),
                    'gender'          => (int)($user->gender ?? 0),
                    'gender_text'     => match ((int)($user->gender ?? 0)) {
                        1 => '男',
                        2 => '女',
                        default => '未知',
                    },
                    'age'             => isset($user->age) ? (int)$user->age : 0,
                    'hospital_name'   => (string)($user->hospital_name ?? ''),
                    'department_name' => (string)($user->department_name ?? ''),
                    'visit_type'      => (int)($user->visit_type ?? 0),
                    'visit_type_text' => match ((int)($user->visit_type ?? 0)) {
                        1 => '门诊',
                        2 => '住院',
                        default => '-',
                    },
                    'is_archived'     => (int)($user->is_archived ?? 0),
                    'enroll_date'     => (string)($user->enroll_date ?? ''),
                    'status'          => (int)($user->status ?? 0),
                    'created_at'      => (string)($user->created_at ?? ''),
                    'updated_at'      => (string)($user->updated_at ?? ''),
                ];
            })
            ->values()
            ->toArray();

        return [
            'list'    => $list,
            'total'   => $paginator->total(),
            'current' => $paginator->currentPage(),
            'size'    => $paginator->perPage(),
        ];
    }

    public function getDetail(int $userId): array
    {
        $user = UserModel::query()->find($userId);
        if (!$user) {
            throw new \InvalidArgumentException('患者不存在');
        }

        return [
            'id'              => (int)$user->id,
            'name'            => (string)($user->name ?? ''),
            'mobile'          => (string)($user->mobile ?? ''),
            'gender'          => (int)($user->gender ?? 0),
            'gender_text'     => match ((int)($user->gender ?? 0)) {
                1 => '男',
                2 => '女',
                default => '未知',
            },
            'age'             => isset($user->age) ? (int)$user->age : 0,
            'hospital_name'   => (string)($user->hospital_name ?? ''),
            'department_name' => (string)($user->department_name ?? ''),
            'visit_type'      => (int)($user->visit_type ?? 0),
            'visit_type_text' => match ((int)($user->visit_type ?? 0)) {
                1 => '门诊',
                2 => '住院',
                default => '-',
            },
            'is_archived'     => (int)($user->is_archived ?? 0),
            'enroll_date'     => (string)($user->enroll_date ?? ''),
            'status'          => (int)($user->status ?? 0),
            'created_at'      => (string)($user->created_at ?? ''),
            'updated_at'      => (string)($user->updated_at ?? ''),
        ];
    }

    public function getSurveyStatus(int $userId): array
    {
        $user = UserModel::query()->find($userId);
        if (!$user) {
            throw new \InvalidArgumentException('患者不存在');
        }

        $templates = SurveyTemplateModel::query()
            ->where('status', 1)
            ->orderBy('id')
            ->get();

        if ($templates->isEmpty()) {
            return [];
        }

        $templateIds = $templates->pluck('id')->all();
        $answerRows = SurveyAnswerModel::query()
            ->where('user_id', $userId)
            ->whereIn('template_id', $templateIds)
            ->selectRaw('template_id, MAX(submitted_at) AS submitted_at, COUNT(*) AS answer_count')
            ->groupBy('template_id')
            ->get()
            ->keyBy('template_id');

        $list = [];
        foreach ($templates as $template) {
            $answer = $answerRows->get($template->id);
            $fillableDay = (int)$template->fillable_day;
            $fillableDate = $this->calcFillableDate((string)($user->enroll_date ?? ''), $fillableDay);
            $list[] = [
                'template_id'   => (int)$template->id,
                'code'          => (string)$template->code,
                'name'          => (string)$template->name,
                'description'   => (string)($template->description ?? ''),
                'fillable_day'  => $fillableDay,
                'fillable_date' => $fillableDate,
                'fillable'      => $fillableDate !== null && date('Y-m-d') >= $fillableDate,
                'answered'      => (bool)$answer,
                'submitted_at'  => $answer ? (string)($answer->submitted_at ?? '') : '',
                'answer_count'  => $answer ? (int)($answer->answer_count ?? 0) : 0,
            ];
        }

        return $list;
    }

    public function getSurveyAnswerDetail(int $userId, int $templateId): array
    {
        $user = UserModel::query()->find($userId);
        if (!$user) {
            throw new \InvalidArgumentException('患者不存在');
        }

        $template = SurveyTemplateModel::query()->find($templateId);
        if (!$template) {
            throw new \InvalidArgumentException('问卷不存在');
        }

        $questions = SurveyQuestionModel::query()
            ->where('template_id', $templateId)
            ->orderBy('sort_order')
            ->orderBy('question_no')
            ->get();

        if ($questions->isEmpty()) {
            return [
                'template' => [
                    'id'   => (int)$template->id,
                    'code' => (string)$template->code,
                    'name' => (string)$template->name,
                ],
                'submitted_at' => '',
                'questions'    => [],
            ];
        }

        $questionIds = $questions->pluck('id')->all();
        $options = SurveyOptionModel::query()
            ->whereIn('question_id', $questionIds)
            ->orderBy('sort_order')
            ->get()
            ->groupBy('question_id');

        $answers = SurveyAnswerModel::query()
            ->where('user_id', $userId)
            ->where('template_id', $templateId)
            ->whereIn('question_id', $questionIds)
            ->get()
            ->keyBy('question_id');

        if ($answers->isEmpty()) {
            throw new \InvalidArgumentException('该患者暂未作答此问卷');
        }

        $submittedAt = (string)($answers->max('submitted_at') ?? '');
        $questionList = [];

        foreach ($questions as $question) {
            $answer = $answers->get($question->id);
            $optionCollection = $options->get($question->id, collect());
            $optionMap = $optionCollection->keyBy('id');
            $selectedOptionIds = is_array($answer?->option_ids) ? array_map('intval', $answer->option_ids) : [];
            $selectedOptions = [];

            foreach ($selectedOptionIds as $optionId) {
                if (!$optionMap->has($optionId)) {
                    continue;
                }
                $option = $optionMap->get($optionId);
                $selectedOptions[] = [
                    'id'            => (int)$option->id,
                    'label'         => (string)$option->label,
                    'is_exclusive'  => (int)$option->is_exclusive === 1,
                    'trigger_input' => (int)$option->trigger_input === 1,
                    'input_fields'  => $this->formatExtraInputs(
                        is_array($option->input_fields) ? $option->input_fields : [],
                        is_array($answer?->extra_inputs) ? $answer->extra_inputs : []
                    ),
                ];
            }

            $questionList[] = [
                'question_id'       => (int)$question->id,
                'question_no'       => (int)$question->question_no,
                'title'             => (string)$question->title,
                'type'              => (string)$question->type,
                'required'          => (int)$question->required === 1,
                'placeholder'       => (string)($question->placeholder ?? ''),
                'answered'          => (bool)$answer,
                'text_value'        => $answer ? (string)($answer->text_value ?? '') : '',
                'selected_options'  => $selectedOptions,
                'answer_summary'    => $this->buildAnswerSummary(
                    (string)$question->type,
                    $selectedOptions,
                    $answer ? (string)($answer->text_value ?? '') : ''
                ),
            ];
        }

        return [
            'template' => [
                'id'           => (int)$template->id,
                'code'         => (string)$template->code,
                'name'         => (string)$template->name,
                'description'  => (string)($template->description ?? ''),
                'fillable_day' => (int)$template->fillable_day,
            ],
            'submitted_at' => $submittedAt,
            'questions'    => $questionList,
        ];
    }

    public function getMedicineList(int $userId, int $current, int $size): array
    {
        $user = UserModel::query()->find($userId);
        if (!$user) {
            throw new \InvalidArgumentException('患者不存在');
        }

        $paginator = UserMedicineModel::query()
            ->where('user_id', $userId)
            ->orderByDesc('id')
            ->paginate(
                $size,
                [
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
                    'created_at',
                    'updated_at',
                ],
                'current',
                $current
            );

        $items = collect($paginator->items());
        $ybms = $items->pluck('ybm')
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

        $list = $items
            ->map(fn(UserMedicineModel $item) => [
                'id'                  => (int)$item->id,
                'name'                => (string)$item->name,
                'specification'       => (string)($item->specification ?? ''),
                'usage'               => (string)($item->usage ?? ''),
                'frequency'           => (int)($item->frequency ?? 0),
                'dosage'              => (string)($item->dosage ?? ''),
                'dosage_value'        => (string)($item->dosage_value ?? ''),
                'dosage_unit'         => (string)($item->dosage_unit ?? ''),
                'remark'              => (string)($item->remark ?? ''),
                'trade_name'          => (string)($item->trade_name ?? ''),
                'company'             => (string)($item->company ?? ''),
                'medicine_count'      => (string)($item->medicine_count ?? ''),
                'ybm'                 => (string)($item->ybm ?? ''),
                'thumb'               => (string)($item->thumb ?? ''),
                'batch_no'            => (string)($item->batch_no ?? ''),
                'sort'                => (int)($item->sort ?? 0),
                'source'              => (string)($item->source ?? ''),
                'source_text'         => (string)($item->source ?? '') === 'ocr' ? '识别导入' : '手动添加',
                'medication_guidance' => $guidanceMap[trim((string)$item->ybm)] ?? '',
                'created_at'          => (string)($item->created_at ?? ''),
                'updated_at'          => (string)($item->updated_at ?? ''),
            ])
            ->values()
            ->toArray();

        return [
            'list'    => $list,
            'total'   => $paginator->total(),
            'current' => $paginator->currentPage(),
            'size'    => $paginator->perPage(),
        ];
    }

    private function calcFillableDate(string $enrollDate, int $fillableDay): ?string
    {
        if ($enrollDate === '') {
            return null;
        }

        $base = strtotime($enrollDate);
        if ($base === false) {
            return null;
        }

        return date('Y-m-d', strtotime('+' . $fillableDay . ' day', $base));
    }

    private function formatExtraInputs(array $fields, array $extraInputs): array
    {
        $list = [];
        foreach ($fields as $field) {
            $key = (string)($field['field_key'] ?? '');
            if ($key === '') {
                continue;
            }
            $list[] = [
                'field_key'   => $key,
                'field_label' => (string)($field['field_label'] ?? $key),
                'value'       => isset($extraInputs[$key]) ? (string)$extraInputs[$key] : '',
            ];
        }
        return $list;
    }

    private function buildAnswerSummary(string $type, array $selectedOptions, string $textValue): string
    {
        if ($type === 'TEXT') {
            return $textValue !== '' ? $textValue : '-';
        }

        if (empty($selectedOptions)) {
            return '-';
        }

        return implode('、', array_map(fn(array $item) => (string)$item['label'], $selectedOptions));
    }
}
