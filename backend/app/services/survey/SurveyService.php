<?php

namespace app\services\survey;

use app\exception\ServiceException;
use app\model\SurveyAnswerModel;
use app\model\SurveyOptionModel;
use app\model\SurveyQuestionModel;
use app\model\SurveyTemplateModel;
use app\model\UserModel;
use support\Db;

class SurveyService
{
    /**
     * 获取问卷模板列表
     * 返回所有启用模板，并标记是否已作答、当前是否可填写
     */
    public function getTemplateList(int $userId): array
    {
        $user = UserModel::query()->find($userId);

        $templates = SurveyTemplateModel::query()
            ->where('status', 1)
            ->orderBy('id')
            ->get();
        if ($templates->isEmpty()) {
            return [];
        }

        $templateIds = $templates->pluck('id')->all();

        $answeredTemplateIds = SurveyAnswerModel::query()
            ->where('user_id', $userId)
            ->whereIn('template_id', $templateIds)
            ->pluck('template_id')
            ->unique()
            ->all();
        $answeredMap = array_flip($answeredTemplateIds);

        $list = [];
        foreach ($templates as $template) {
            $fillableDay = (int)$template->fillable_day;
            $fillableDate = $this->calcFillableDate($user, $fillableDay);
            $list[] = [
                'templateId'   => (int)$template->id,
                'code'         => (string)$template->code,
                'name'         => (string)$template->name,
                'description'  => (string)($template->description ?? ''),
                'fillableDay'  => $fillableDay,
                'fillableDate' => $fillableDate,
                'fillable'     => $fillableDate !== null && date('Y-m-d') >= $fillableDate,
                'answered'     => isset($answeredMap[$template->id]),
            ];
        }
        return $list;
    }

    /**
     * 获取问卷（模板 + 题目 + 选项）
     * 根据用户建档日期和模板 fillable_day 判断是否可填写，未到时间不返回题目详情
     */
    public function getSurvey(string $templateCode, int $userId): array
    {
        $template = SurveyTemplateModel::query()
            ->where('code', $templateCode)
            ->where('status', 1)
            ->first();
        if (!$template) {
            throw new ServiceException('问卷模板不存在');
        }

        $user = UserModel::query()->find($userId);
        $fillableDay = (int)$template->fillable_day;
        $fillableDate = $this->calcFillableDate($user, $fillableDay);
        $fillable = $fillableDate !== null && date('Y-m-d') >= $fillableDate;

        if (!$fillable) {
            return [
                'templateId'   => (int)$template->id,
                'code'         => (string)$template->code,
                'name'         => (string)$template->name,
                'description'  => (string)($template->description ?? ''),
                'fillableDay'  => $fillableDay,
                'fillableDate' => $fillableDate,
                'fillable'     => false,
                'questions'    => [],
            ];
        }

        $questions = SurveyQuestionModel::query()
            ->where('template_id', $template->id)
            ->orderBy('sort_order')
            ->get();

        $questionIds = $questions->pluck('id')->all();

        $options = SurveyOptionModel::query()
            ->whereIn('question_id', $questionIds)
            ->orderBy('sort_order')
            ->get()
            ->groupBy('question_id');

        $questionList = [];
        foreach ($questions as $question) {
            $item = [
                'questionId' => (int)$question->id,
                'questionNo' => (int)$question->question_no,
                'title'      => (string)$question->title,
                'type'       => (string)$question->type,
                'required'   => (int)$question->required === 1,
                'sortOrder'  => (int)$question->sort_order,
            ];
            if ($question->placeholder) {
                $item['placeholder'] = (string)$question->placeholder;
            }
            $item['options'] = $this->formatOptions($options->get($question->id));
            $questionList[] = $item;
        }

        return [
            'templateId'   => (int)$template->id,
            'code'         => (string)$template->code,
            'name'         => (string)$template->name,
            'description'  => (string)($template->description ?? ''),
            'fillableDay'  => $fillableDay,
            'fillableDate' => $fillableDate,
            'fillable'     => true,
            'questions'    => $questionList,
        ];
    }

    /**
     * 提交答案
     */
    public function submitAnswers(string $templateCode, int $userId, array $answers): array
    {
        $template = SurveyTemplateModel::query()
            ->where('code', $templateCode)
            ->where('status', 1)
            ->first();
        if (!$template) {
            throw new ServiceException('问卷模板不存在');
        }

        $user = UserModel::query()->find($userId);

        $fillableDate = $this->calcFillableDate($user, (int)$template->fillable_day);
        if ($fillableDate === null || date('Y-m-d') < $fillableDate) {
            throw new ServiceException('未到可填写时间');
        }

        $exists = SurveyAnswerModel::query()
            ->where('user_id', $userId)
            ->where('template_id', $template->id)
            ->exists();
        if ($exists) {
            throw new ServiceException('您已填写过该问卷，不可重复提交');
        }

        $questions = SurveyQuestionModel::query()
            ->where('template_id', $template->id)
            ->orderBy('sort_order')
            ->get()
            ->keyBy('id');

        $questionIds = $questions->keys()->all();
        $options = SurveyOptionModel::query()
            ->whereIn('question_id', $questionIds)
            ->get()
            ->groupBy('question_id');

        $answerMap = [];
        foreach ($answers as $ans) {
            $qid = (int)($ans['questionId'] ?? 0);
            if ($qid <= 0) {
                throw new ServiceException('题目ID格式不正确');
            }
            if (isset($answerMap[$qid])) {
                throw new ServiceException('存在重复提交的题目');
            }
            $answerMap[$qid] = $ans;
        }

        foreach ($questions as $qid => $question) {
            if ((int)$question->required === 1 && !isset($answerMap[$qid])) {
                throw new ServiceException('第' . $question->question_no . '题为必填题，请作答');
            }
        }

        $rows = [];
        $now = date('Y-m-d H:i:s');
        foreach ($answerMap as $qid => $ans) {
            if (!isset($questions[$qid])) {
                throw new ServiceException('题目ID非法');
            }
            $question = $questions[$qid];
            $questionOptions = $options->get($qid, collect());
            $optionMap = $questionOptions->keyBy('id');

            $optionIds   = $ans['optionIds'] ?? null;
            $textValue   = $ans['textValue'] ?? null;
            $extraInputs = $ans['extraInputs'] ?? null;

            switch ($question->type) {
                case 'RADIO':
                    $optionIds = $this->validateRadio($optionIds, $optionMap, (int)$question->question_no);
                    $this->validateExtraInputs($optionIds, $optionMap, $extraInputs, (int)$question->question_no);
                    $textValue = null;
                    break;
                case 'CHECKBOX':
                    $optionIds = $this->validateCheckbox($optionIds, $optionMap, (int)$question->question_no);
                    $this->validateExtraInputs($optionIds, $optionMap, $extraInputs, (int)$question->question_no);
                    $textValue = null;
                    break;
                case 'TEXT':
                    $textValue = $this->validateText($textValue, (int)$question->required, (int)$question->question_no);
                    $optionIds = null;
                    $extraInputs = null;
                    break;
                default:
                    throw new ServiceException('题型不支持');
            }

            $rows[] = [
                'template_id'  => $template->id,
                'user_id'      => $userId,
                'question_id'  => $qid,
                'option_ids'   => $optionIds ? json_encode(array_values($optionIds), JSON_UNESCAPED_UNICODE) : null,
                'text_value'   => $textValue !== null ? $textValue : null,
                'extra_inputs' => $extraInputs ? json_encode($extraInputs, JSON_UNESCAPED_UNICODE) : null,
                'submitted_at' => $now,
            ];
        }

        Db::beginTransaction();
        try {
            SurveyAnswerModel::query()->insert($rows);
            Db::commit();
        } catch (\Throwable $e) {
            Db::rollBack();
            throw new ServiceException('提交失败，请稍后再试');
        }

        return [
            'submittedAt' => $now,
        ];
    }

    /**
     * 计算可填写日期（建档日期 + fillable_day）
     * 接受 UserModel 对象或用户ID，返回 Y-m-d 格式，无建档日期时返回 null
     */
    private function calcFillableDate($userOrId, int $fillableDay): ?string
    {
        $user = $userOrId instanceof UserModel ? $userOrId : UserModel::query()->find($userOrId);
        if (!$user || !$user->enroll_date) {
            return null;
        }
        $enrollDate = (string)$user->enroll_date;
        return date('Y-m-d', strtotime("{$enrollDate} +{$fillableDay} days"));
    }

    private function formatOptions($optionCollection): array
    {
        if (!$optionCollection) {
            return [];
        }
        $list = [];
        foreach ($optionCollection as $opt) {
            $item = [
                'id'           => (int)$opt->id,
                'label'        => (string)$opt->label,
                'triggerInput' => (int)$opt->trigger_input === 1,
            ];
            if ((int)$opt->is_exclusive === 1) {
                $item['isExclusive'] = true;
            }
            if ((int)$opt->trigger_input === 1 && !empty($opt->input_fields)) {
                $item['inputFields'] = $opt->input_fields;
            }
            $list[] = $item;
        }
        return $list;
    }

    private function validateRadio($optionIds, $optionMap, int $questionNo): array
    {
        if (!is_array($optionIds) || count($optionIds) !== 1) {
            throw new ServiceException('第' . $questionNo . '题请选择一个选项');
        }
        $id = (int)$optionIds[0];
        if (!$optionMap->has($id)) {
            throw new ServiceException('第' . $questionNo . '题选项ID非法');
        }
        return [$id];
    }

    private function validateCheckbox($optionIds, $optionMap, int $questionNo): array
    {
        if (!is_array($optionIds) || count($optionIds) < 1) {
            throw new ServiceException('第' . $questionNo . '题至少选择一个选项');
        }
        $ids = array_values(array_unique(array_map('intval', $optionIds)));
        foreach ($ids as $id) {
            if (!$optionMap->has($id)) {
                throw new ServiceException('第' . $questionNo . '题选项ID非法');
            }
        }
        $hasExclusive = false;
        $exclusiveLabel = '';
        foreach ($ids as $id) {
            if ((int)$optionMap->get($id)->is_exclusive === 1) {
                $hasExclusive = true;
                $exclusiveLabel = (string)$optionMap->get($id)->label;
                break;
            }
        }
        if ($hasExclusive && count($ids) > 1) {
            throw new ServiceException('第' . $questionNo . '题选择"' . $exclusiveLabel . '"时不可同时选择其他选项');
        }
        return $ids;
    }

    private function validateText($textValue, int $required, int $questionNo): string
    {
        $textValue = is_string($textValue) ? trim($textValue) : '';
        if ($required === 1 && $textValue === '') {
            throw new ServiceException('第' . $questionNo . '题为必填题，请作答');
        }
        if ($textValue !== '' && mb_strlen($textValue) > 500) {
            throw new ServiceException('第' . $questionNo . '题文本不能超过500字符');
        }
        return $textValue;
    }

    private function validateExtraInputs(array $optionIds, $optionMap, $extraInputs, int $questionNo): void
    {
        if (empty($optionIds)) {
            return;
        }
        $extraInputs = is_array($extraInputs) ? $extraInputs : [];
        foreach ($optionIds as $id) {
            $option = $optionMap->get($id);
            if (!$option || (int)$option->trigger_input !== 1) {
                continue;
            }
            $fields = $option->input_fields;
            if (!is_array($fields)) {
                continue;
            }
            foreach ($fields as $field) {
                $key = $field['field_key'] ?? '';
                $label = $field['field_label'] ?? $key;
                $isRequired = (bool)($field['required'] ?? false);
                $value = $extraInputs[$key] ?? '';
                $value = is_string($value) ? trim($value) : (string)$value;
                if ($isRequired && $value === '') {
                    throw new ServiceException('第' . $questionNo . '题字段"' . $label . '"必填');
                }
            }
        }
    }
}
