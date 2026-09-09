<?php

namespace app\services\survey;

use app\exception\ServiceException;
use app\model\SurveyAnswerModel;
use app\model\SurveyOptionModel;
use app\model\SurveyQuestionModel;
use app\model\SurveyTemplateModel;
use app\model\UserModel;
use support\Db;
use Vtiful\Kernel\Excel;

/**
 * 问卷后台管理服务
 * 提供模板（含题目、选项）的增删改查，问卷结构完全由后台数据驱动。
 */
class SurveyAdminService
{
    private const TYPES = ['RADIO', 'CHECKBOX', 'TEXT'];

    /**
     * 模板分页列表（含停用），带题目数与作答数
     */
    public function list(array $params): array
    {
        $page     = max(1, (int)($params['page'] ?? 1));
        $pageSize = max(1, min(100, (int)($params['page_size'] ?? 20)));
        $keyword  = trim((string)($params['keyword'] ?? ''));
        $status   = $params['status'] ?? null;

        $query = SurveyTemplateModel::query()->orderByDesc('id');

        if ($keyword !== '') {
            $query->where(function ($q) use ($keyword) {
                $q->where('name', 'like', "%{$keyword}%")
                  ->orWhere('code', 'like', "%{$keyword}%");
            });
        }
        if ($status !== null && $status !== '') {
            $query->where('status', (int)$status);
        }

        $total = $query->count();
        $templates = $query->forPage($page, $pageSize)->get();

        $templateIds = $templates->pluck('id')->all();
        $questionCounts = SurveyQuestionModel::query()
            ->whereIn('template_id', $templateIds)
            ->selectRaw('template_id, COUNT(*) AS cnt')
            ->groupBy('template_id')
            ->pluck('cnt', 'template_id');
        $answerCounts = SurveyAnswerModel::query()
            ->whereIn('template_id', $templateIds)
            ->selectRaw('template_id, COUNT(*) AS cnt')
            ->groupBy('template_id')
            ->pluck('cnt', 'template_id');

        $list = [];
        foreach ($templates as $t) {
            $list[] = [
                'id'            => (int)$t->id,
                'code'          => (string)$t->code,
                'name'          => (string)$t->name,
                'description'   => (string)($t->description ?? ''),
                'fillableDay'   => (int)$t->fillable_day,
                'status'        => (int)$t->status,
                'questionCount' => (int)($questionCounts[$t->id] ?? 0),
                'answerCount'   => (int)($answerCounts[$t->id] ?? 0),
                'createdAt'     => (string)$t->created_at,
            ];
        }

        return [
            'list'     => $list,
            'total'    => $total,
            'page'     => $page,
            'pageSize' => $pageSize,
        ];
    }

    /**
     * 模板详情：完整模板树（模板 + 题目 + 选项），供后台编辑回显
     */
    public function detail(int $id): array
    {
        $template = SurveyTemplateModel::query()->find($id);
        if (!$template) {
            throw new ServiceException('问卷模板不存在');
        }

        $questions = SurveyQuestionModel::query()
            ->where('template_id', $id)
            ->orderBy('sort_order')
            ->get();

        $questionIds = $questions->pluck('id')->all();
        $options = SurveyOptionModel::query()
            ->whereIn('question_id', $questionIds)
            ->orderBy('sort_order')
            ->get()
            ->groupBy('question_id');

        $questionList = [];
        foreach ($questions as $q) {
            $questionList[] = $this->formatQuestion($q, $options->get($q->id));
        }

        return [
            'id'           => (int)$template->id,
            'code'         => (string)$template->code,
            'name'         => (string)$template->name,
            'description'  => (string)($template->description ?? ''),
            'fillableDay'  => (int)$template->fillable_day,
            'status'       => (int)$template->status,
            'createdAt'    => (string)$template->created_at,
            'updatedAt'    => (string)$template->updated_at,
            'questions'    => $questionList,
        ];
    }

    public function exportAnswers(int $id): array
    {
        $template = SurveyTemplateModel::query()->find($id);
        if (!$template) {
            throw new ServiceException('问卷模板不存在');
        }

        $questions = SurveyQuestionModel::query()
            ->where('template_id', $id)
            ->orderBy('sort_order')
            ->orderBy('question_no')
            ->get();

        $questionIds = $questions->pluck('id')->all();
        $optionsByQuestion = collect();
        if (!empty($questionIds)) {
            $optionsByQuestion = SurveyOptionModel::query()
                ->whereIn('question_id', $questionIds)
                ->orderBy('sort_order')
                ->get()
                ->groupBy('question_id');
        }

        $answers = SurveyAnswerModel::query()
            ->where('template_id', $id)
            ->orderBy('user_id')
            ->orderBy('question_id')
            ->get();

        $userIds = $answers->pluck('user_id')->map(fn ($userId) => (int)$userId)->unique()->values()->all();
        $users = empty($userIds)
            ? collect()
            : UserModel::query()
                ->whereIn('id', $userIds)
                ->get(['id', 'name', 'mobile'])
                ->keyBy('id');

        $headers = ['患者ID', '患者姓名', '手机号', '提交时间'];
        foreach ($questions as $question) {
            $headers[] = sprintf('第%s题 %s', (string)$question->question_no, (string)$question->title);
        }

        $rows = [];
        foreach ($answers->groupBy('user_id') as $userId => $userAnswers) {
            $user = $users->get((int)$userId);
            $answerMap = $userAnswers->keyBy('question_id');
            $submittedAt = (string)($userAnswers->max('submitted_at') ?? '');

            $row = [
                (int)$userId,
                (string)($user->name ?? ''),
                (string)($user->mobile ?? ''),
                $submittedAt,
            ];

            foreach ($questions as $question) {
                $row[] = $this->buildQuestionAnswerSummary(
                    (string)$question->type,
                    $answerMap->get($question->id),
                    $optionsByQuestion->get($question->id, collect())
                );
            }

            $rows[] = $row;
        }

        $exportDir = base_path() . '/runtime/exports';
        if (!is_dir($exportDir)) {
            mkdir($exportDir, 0777, true);
        }

        $storedFileName = sprintf('survey_answers_%d_%s.xlsx', $id, date('Ymd_His'));
        $downloadFileName = sprintf('survey_answers_%s_%s.xlsx', (string)$template->code, date('Ymd_His'));

        $filePath = (new Excel(['path' => $exportDir]))
            ->fileName($storedFileName, '问卷答题数据')
            ->header($headers)
            ->setColumn('A:D', 18)
            ->setColumn('E:' . Excel::stringFromColumnIndex(count($headers) - 1), 36)
            ->data($rows)
            ->output();

        return [
            'file_path' => $filePath,
            'file_name' => $downloadFileName,
        ];
    }

    /**
     * 新建或更新模板（含题目、选项），单事务 upsert-by-id
     * 已有作答记录的模板：禁止删除题目/选项、禁止改题型与选项编码，其余可改
     */
    public function save(array $payload): array
    {
        $this->validatePayload($payload);

        $id = (int)($payload['id'] ?? 0);

        Db::beginTransaction();
        try {
            if ($id > 0) {
                $template = SurveyTemplateModel::query()->find($id);
                if (!$template) {
                    throw new ServiceException('问卷模板不存在');
                }
                $hasAnswers = SurveyAnswerModel::query()->where('template_id', $id)->exists();

                // code 唯一性（排除自身）
                $codeExists = SurveyTemplateModel::query()
                    ->where('code', $payload['code'])
                    ->where('id', '!=', $id)
                    ->exists();
                if ($codeExists) {
                    throw new ServiceException('模板编码已存在');
                }

                $template->code         = $payload['code'];
                $template->name         = $payload['name'];
                $template->description  = $payload['description'];
                $template->fillable_day = $payload['fillable_day'];
                $template->status       = $payload['status'];
                $template->save();

                $this->syncQuestions($id, $payload['questions'], $hasAnswers);
                Db::commit();
                return ['id' => $id];
            }

            // 新建
            $codeExists = SurveyTemplateModel::query()->where('code', $payload['code'])->exists();
            if ($codeExists) {
                throw new ServiceException('模板编码已存在');
            }

            $template = SurveyTemplateModel::query()->create([
                'code'         => $payload['code'],
                'name'         => $payload['name'],
                'description'  => $payload['description'],
                'fillable_day' => $payload['fillable_day'],
                'status'       => $payload['status'],
            ]);
            $newId = (int)$template->id;
            $this->syncQuestions($newId, $payload['questions'], false);
            Db::commit();
            return ['id' => $newId];
        } catch (ServiceException $e) {
            Db::rollBack();
            throw $e;
        } catch (\Throwable $e) {
            Db::rollBack();
            throw new ServiceException('保存失败，请稍后再试');
        }
    }

    /**
     * 删除模板（含题目、选项）；已有作答记录则拒绝
     */
    public function delete(int $id): array
    {
        $template = SurveyTemplateModel::query()->find($id);
        if (!$template) {
            throw new ServiceException('问卷模板不存在');
        }
        if (SurveyAnswerModel::query()->where('template_id', $id)->exists()) {
            throw new ServiceException('该问卷已有作答记录，无法删除，请改为停用');
        }

        Db::beginTransaction();
        try {
            $questionIds = SurveyQuestionModel::query()->where('template_id', $id)->pluck('id')->all();
            if ($questionIds) {
                SurveyOptionModel::query()->whereIn('question_id', $questionIds)->delete();
                SurveyQuestionModel::query()->where('template_id', $id)->delete();
            }
            $template->delete();
            Db::commit();
        } catch (\Throwable $e) {
            Db::rollBack();
            throw new ServiceException('删除失败，请稍后再试');
        }

        return ['id' => $id];
    }

    /**
     * 启用/停用模板
     */
    public function toggleStatus(int $id, int $status): array
    {
        if (!in_array($status, [0, 1], true)) {
            throw new ServiceException('状态值不合法');
        }
        $template = SurveyTemplateModel::query()->find($id);
        if (!$template) {
            throw new ServiceException('问卷模板不存在');
        }
        $template->status = $status;
        $template->save();

        return ['id' => $id, 'status' => $status];
    }

    // ------------------------------------------------------------------
    // 内部方法
    // ------------------------------------------------------------------

    /**
     * 同步题目与选项（upsert-by-id）
     */
    private function syncQuestions(int $templateId, array $questions, bool $hasAnswers): void
    {
        $existingQuestions = SurveyQuestionModel::query()
            ->where('template_id', $templateId)
            ->get()
            ->keyBy('id');

        $keepQuestionIds = [];
        $payloadQuestionNos = [];

        foreach ($questions as $q) {
            $qid = (int)($q['id'] ?? 0);
            $questionNo = (int)$q['question_no'];
            $payloadQuestionNos[] = $questionNo;

            if ($qid > 0) {
                if (!$existingQuestions->has($qid)) {
                    throw new ServiceException('题目ID非法：' . $qid);
                }
                $old = $existingQuestions->get($qid);
                if ($hasAnswers && $old->type !== $q['type']) {
                    throw new ServiceException('该问卷已有作答记录，无法修改第' . $questionNo . '题的题型，请停用后新建');
                }

                SurveyQuestionModel::query()->where('id', $qid)->update([
                    'question_no' => $questionNo,
                    'title'       => $q['title'],
                    'type'        => $q['type'],
                    'required'    => $q['required'],
                    'sort_order'  => $q['sort_order'],
                    'placeholder' => $q['placeholder'],
                ]);
                $keepQuestionIds[] = $qid;
                $this->syncOptions($qid, $q['options'] ?? [], $hasAnswers);
            } else {
                $newQ = SurveyQuestionModel::query()->create([
                    'template_id' => $templateId,
                    'question_no' => $questionNo,
                    'title'       => $q['title'],
                    'type'        => $q['type'],
                    'required'    => $q['required'],
                    'sort_order'  => $q['sort_order'],
                    'placeholder' => $q['placeholder'],
                ]);
                $newQid = (int)$newQ->id;
                $keepQuestionIds[] = $newQid;
                $this->syncOptions($newQid, $q['options'] ?? [], $hasAnswers);
            }
        }

        // 题号唯一性
        if (count($payloadQuestionNos) !== count(array_unique($payloadQuestionNos))) {
            throw new ServiceException('题号不能重复');
        }

        // 删除 payload 中缺失的题目（含其选项）
        $deleteQuestionIds = $existingQuestions->keys()->diff($keepQuestionIds)->all();
        if ($deleteQuestionIds) {
            if ($hasAnswers) {
                throw new ServiceException('该问卷已有作答记录，无法删除题目，请停用后新建');
            }
            SurveyOptionModel::query()->whereIn('question_id', $deleteQuestionIds)->delete();
            SurveyQuestionModel::query()->whereIn('id', $deleteQuestionIds)->delete();
        }
    }

    /**
     * 同步某题目下的选项（upsert-by-id）
     * 注意：input_fields 为 JSON 列，必须经模型实例 save() 触发 cast 编码，
     * 不能用查询构建器 update()（其绕过 cast）。
     */
    private function syncOptions(int $questionId, array $options, bool $hasAnswers): void
    {
        $existingOptions = SurveyOptionModel::query()
            ->where('question_id', $questionId)
            ->get()
            ->keyBy('id');

        $keepOptionIds = [];

        foreach ($options as $opt) {
            $oid = (int)($opt['id'] ?? 0);
            $triggerInput = (int)$opt['trigger_input'];
            $inputFields  = $triggerInput === 1 ? $opt['input_fields'] : null;

            if ($oid > 0) {
                if (!$existingOptions->has($oid)) {
                    throw new ServiceException('选项ID非法：' . $oid);
                }
                $model = $existingOptions->get($oid);

                $model->label         = $opt['label'];
                $model->sort_order    = $opt['sort_order'];
                $model->is_exclusive  = $opt['is_exclusive'];
                $model->trigger_input = $triggerInput;
                $model->input_fields  = $inputFields;
                $model->save();
                $keepOptionIds[] = $oid;
            } else {
                $model = new SurveyOptionModel();
                $model->question_id   = $questionId;
                $model->label         = $opt['label'];
                $model->sort_order    = $opt['sort_order'];
                $model->is_exclusive  = $opt['is_exclusive'];
                $model->trigger_input = $triggerInput;
                $model->input_fields  = $inputFields;
                $model->save();
                $keepOptionIds[] = (int)$model->id;
            }
        }

        // 删除 payload 中缺失的选项
        $deleteOptionIds = $existingOptions->keys()->diff($keepOptionIds)->all();
        if ($deleteOptionIds) {
            if ($hasAnswers) {
                throw new ServiceException('该问卷已有作答记录，无法删除选项，请停用后新建');
            }
            SurveyOptionModel::query()->whereIn('id', $deleteOptionIds)->delete();
        }
    }

    /**
     * 校验整棵模板树
     */
    private function validatePayload(array $payload): void
    {
        $code = trim((string)($payload['code'] ?? ''));
        if ($code === '' || mb_strlen($code) > 64) {
            throw new ServiceException('模板编码必填且不超过64字符');
        }
        $name = trim((string)($payload['name'] ?? ''));
        if ($name === '' || mb_strlen($name) > 128) {
            throw new ServiceException('模板名称必填且不超过128字符');
        }
        $description = (string)($payload['description'] ?? '');
        if (mb_strlen($description) > 256) {
            throw new ServiceException('问卷说明不超过256字符');
        }
        $fillableDay = (int)($payload['fillable_day'] ?? -1);
        if ($fillableDay < 0) {
            throw new ServiceException('可填写天数不合法');
        }
        $status = (int)($payload['status'] ?? 1);
        if (!in_array($status, [0, 1], true)) {
            throw new ServiceException('状态值不合法');
        }
        $questions = $payload['questions'] ?? [];
        if (!is_array($questions) || count($questions) === 0) {
            throw new ServiceException('至少需要一道题目');
        }

        $questionNos = [];
        foreach ($questions as $q) {
            $this->validateQuestion($q);
            $questionNos[] = (int)$q['question_no'];
        }
        if (count($questionNos) !== count(array_unique($questionNos))) {
            throw new ServiceException('题号不能重复');
        }
    }

    private function validateQuestion(array $q): void
    {
        $questionNo = (int)($q['question_no'] ?? 0);
        if ($questionNo < 1) {
            throw new ServiceException('题号不合法');
        }
        $title = trim((string)($q['title'] ?? ''));
        if ($title === '' || mb_strlen($title) > 512) {
            throw new ServiceException('第' . $questionNo . '题题干必填且不超过512字符');
        }
        $type = (string)($q['type'] ?? '');
        if (!in_array($type, self::TYPES, true)) {
            throw new ServiceException('第' . $questionNo . '题题型不合法');
        }
        $required = (int)($q['required'] ?? 1);
        if (!in_array($required, [0, 1], true)) {
            throw new ServiceException('第' . $questionNo . '题必填标记不合法');
        }
        $sortOrder = (int)($q['sort_order'] ?? 0);
        if ($sortOrder < 0) {
            throw new ServiceException('第' . $questionNo . '题排序不合法');
        }
        $placeholder = (string)($q['placeholder'] ?? '');
        if (mb_strlen($placeholder) > 256) {
            throw new ServiceException('第' . $questionNo . '题占位提示不超过256字符');
        }

        $options = $q['options'] ?? [];
        if ($type === 'TEXT') {
            // 文本题不使用选项，强制忽略
            return;
        }
        if (!is_array($options) || count($options) === 0) {
            throw new ServiceException('第' . $questionNo . '题至少需要一个选项');
        }
        foreach ($options as $opt) {
            $this->validateOption($opt, $questionNo);
        }
    }

    private function validateOption(array $opt, int $questionNo): void
    {
        $label = trim((string)($opt['label'] ?? ''));
        if ($label === '' || mb_strlen($label) > 128) {
            throw new ServiceException('第' . $questionNo . '题选项文案必填且不超过128字符');
        }
        if ((int)($opt['sort_order'] ?? 0) < 0) {
            throw new ServiceException('第' . $questionNo . '题选项排序不合法');
        }
        if (!in_array((int)($opt['is_exclusive'] ?? 0), [0, 1], true)) {
            throw new ServiceException('第' . $questionNo . '题选项互斥标记不合法');
        }
        $triggerInput = (int)($opt['trigger_input'] ?? 0);
        if (!in_array($triggerInput, [0, 1], true)) {
            throw new ServiceException('第' . $questionNo . '题选项触发输入标记不合法');
        }
        if ($triggerInput === 1) {
            $fields = $opt['input_fields'] ?? null;
            if (!is_array($fields) || count($fields) === 0) {
                throw new ServiceException('第' . $questionNo . '题选项"' . $label . '"需配置条件输入字段');
            }
            foreach ($fields as $field) {
                $fkey = trim((string)($field['field_key'] ?? ''));
                $flabel = trim((string)($field['field_label'] ?? ''));
                if ($fkey === '' || $flabel === '') {
                    throw new ServiceException('第' . $questionNo . '题选项"' . $label . '"条件输入字段缺少 field_key/field_label');
                }
            }
        }
    }

    private function formatQuestion($q, $optionCollection): array
    {
        $item = [
            'id'          => (int)$q->id,
            'questionNo'  => (int)$q->question_no,
            'title'       => (string)$q->title,
            'type'        => (string)$q->type,
            'required'    => (int)$q->required,
            'sortOrder'   => (int)$q->sort_order,
            'placeholder' => $q->placeholder ? (string)$q->placeholder : '',
            'options'     => [],
        ];
        if ($optionCollection) {
            foreach ($optionCollection as $opt) {
                $item['options'][] = [
                    'id'            => (int)$opt->id,
                    'label'         => (string)$opt->label,
                    'sortOrder'     => (int)$opt->sort_order,
                    'isExclusive'   => (int)$opt->is_exclusive === 1,
                    'triggerInput'  => (int)$opt->trigger_input === 1,
                    'inputFields'   => (int)$opt->trigger_input === 1 ? $opt->input_fields : null,
                ];
            }
        }
        return $item;
    }

    private function buildQuestionAnswerSummary(string $type, ?SurveyAnswerModel $answer, $optionCollection): string
    {
        if (!$answer) {
            return '-';
        }

        if ($type === 'TEXT') {
            $textValue = trim((string)($answer->text_value ?? ''));
            return $textValue !== '' ? $textValue : '-';
        }

        $selectedOptionIds = is_array($answer->option_ids) ? array_map('intval', $answer->option_ids) : [];
        if (empty($selectedOptionIds)) {
            return '-';
        }

        $optionMap = collect($optionCollection)->keyBy('id');
        $extraInputs = is_array($answer->extra_inputs) ? $answer->extra_inputs : [];
        $parts = [];

        foreach ($selectedOptionIds as $optionId) {
            if (!$optionMap->has($optionId)) {
                continue;
            }

            $option = $optionMap->get($optionId);
            $label = (string)($option->label ?? '');

            if ((int)($option->trigger_input ?? 0) === 1 && is_array($option->input_fields)) {
                $inputSummary = $this->buildExtraInputSummary($option->input_fields, $extraInputs);
                if ($inputSummary !== '') {
                    $label .= '（' . $inputSummary . '）';
                }
            }

            $parts[] = $label;
        }

        return empty($parts) ? '-' : implode('、', $parts);
    }

    private function buildExtraInputSummary(array $fields, array $extraInputs): string
    {
        $parts = [];
        foreach ($fields as $field) {
            $key = (string)($field['field_key'] ?? '');
            if ($key === '' || !isset($extraInputs[$key])) {
                continue;
            }

            $value = trim((string)$extraInputs[$key]);
            if ($value === '') {
                continue;
            }

            $label = (string)($field['field_label'] ?? $key);
            $parts[] = $label . '：' . $value;
        }

        return implode('；', $parts);
    }
}
