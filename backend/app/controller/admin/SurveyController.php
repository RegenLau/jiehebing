<?php

namespace app\controller\admin;

use app\exception\ServiceException;
use app\services\survey\SurveyAdminService;
use support\Request;
use Throwable;

class SurveyController extends AdminBaseController
{
    public function __construct(
        private readonly SurveyAdminService $service = new SurveyAdminService()
    ) {
    }

    public function index(Request $request): \support\Response
    {
        $result = $this->service->list([
            'page'      => max(1, (int)$request->get('current', 1)),
            'page_size' => max(1, min(100, (int)$request->get('size', 10))),
            'keyword'   => trim((string)$request->get('keyword', '')),
            'status'    => $request->get('status', ''),
        ]);

        return $this->ok([
            'list'    => $result['list'] ?? [],
            'total'   => (int)($result['total'] ?? 0),
            'current' => (int)($result['page'] ?? 1),
            'size'    => (int)($result['pageSize'] ?? 10),
        ]);
    }

    public function detail(Request $request): \support\Response
    {
        $id = (int)$request->get('id', 0);
        if ($id <= 0) {
            return $this->fail('问卷ID不能为空', 422);
        }

        try {
            return $this->ok($this->service->detail($id));
        } catch (ServiceException $e) {
            return $this->fail($e->getMessage(), 422);
        }
    }

    public function export(Request $request): \support\Response
    {
        $id = (int)$request->get('id', 0);
        if ($id <= 0) {
            return $this->fail('问卷ID不能为空', 422);
        }

        try {
            $exportFile = $this->service->exportAnswers($id);
            return response()->download($exportFile['file_path'], $exportFile['file_name']);
        } catch (ServiceException $e) {
            return $this->fail($e->getMessage(), 422);
        } catch (Throwable $e) {
            return $this->fail('导出失败：' . $e->getMessage(), 500);
        }
    }

    public function save(Request $request): \support\Response
    {
        try {
            return $this->ok($this->service->save($this->normalizePayload($request->post())), '保存成功');
        } catch (ServiceException $e) {
            return $this->fail($e->getMessage(), 422);
        }
    }

    public function delete(Request $request): \support\Response
    {
        $id = (int)$request->post('id', 0);
        if ($id <= 0) {
            return $this->fail('问卷ID不能为空', 422);
        }

        try {
            return $this->ok($this->service->delete($id), '删除成功');
        } catch (ServiceException $e) {
            return $this->fail($e->getMessage(), 422);
        }
    }

    public function toggleStatus(Request $request): \support\Response
    {
        $id = (int)$request->post('id', 0);
        $status = (int)$request->post('status', -1);
        if ($id <= 0) {
            return $this->fail('问卷ID不能为空', 422);
        }

        try {
            return $this->ok($this->service->toggleStatus($id, $status), '操作成功');
        } catch (ServiceException $e) {
            return $this->fail($e->getMessage(), 422);
        }
    }

    private function normalizePayload(array $payload): array
    {
        $payload['fillable_day'] = (int)($payload['fillable_day'] ?? $payload['fillableDay'] ?? 0);
        $payload['status'] = (int)($payload['status'] ?? 1);

        $questions = [];
        foreach ((array)($payload['questions'] ?? []) as $question) {
            $options = [];
            foreach ((array)($question['options'] ?? []) as $option) {
                $options[] = [
                    'id'            => isset($option['id']) ? (int)$option['id'] : 0,
                    'label'         => trim((string)($option['label'] ?? '')),
                    'sort_order'    => (int)($option['sort_order'] ?? $option['sortOrder'] ?? 0),
                    'is_exclusive'  => (int)($option['is_exclusive'] ?? $option['isExclusive'] ?? 0),
                    'trigger_input' => (int)($option['trigger_input'] ?? $option['triggerInput'] ?? 0),
                    'input_fields'  => $option['input_fields'] ?? $option['inputFields'] ?? null,
                ];
            }

            $questions[] = [
                'id'          => isset($question['id']) ? (int)$question['id'] : 0,
                'question_no' => (int)($question['question_no'] ?? $question['questionNo'] ?? 0),
                'title'       => trim((string)($question['title'] ?? '')),
                'type'        => trim((string)($question['type'] ?? '')),
                'required'    => (int)($question['required'] ?? 1),
                'sort_order'  => (int)($question['sort_order'] ?? $question['sortOrder'] ?? 0),
                'placeholder' => trim((string)($question['placeholder'] ?? '')),
                'options'     => $options,
            ];
        }
        $payload['questions'] = $questions;

        if (isset($payload['id']) && $payload['id'] !== '') {
            $payload['id'] = (int)$payload['id'];
        } else {
            unset($payload['id']);
        }

        return $payload;
    }
}
