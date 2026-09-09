<?php

namespace app\controller\admin;

use app\exception\ServiceException;
use app\services\admin\HealthArticleService;
use support\Request;

class HealthArticleController extends AdminBaseController
{
    public function __construct(
        private readonly HealthArticleService $service = new HealthArticleService()
    ) {
    }

    public function index(Request $request): \support\Response
    {
        $current = max(1, (int)$request->get('current', 1));
        $size = max(1, min(100, (int)$request->get('size', 10)));
        $keyword = trim((string)$request->get('keyword', ''));
        $status = trim((string)$request->get('status', ''));

        return $this->ok($this->service->getList($current, $size, $keyword, $status));
    }

    public function detail(Request $request): \support\Response
    {
        $id = max(0, (int)$request->get('id', 0));
        if ($id <= 0) {
            return $this->fail('文章ID不能为空', 422);
        }

        try {
            return $this->ok($this->service->getDetail($id));
        } catch (ServiceException $e) {
            return $this->fail($e->getMessage(), $e->getCode());
        }
    }

    public function save(Request $request): \support\Response
    {
        try {
            return $this->ok($this->service->save($request->post()), '保存成功');
        } catch (ServiceException $e) {
            return $this->fail($e->getMessage(), $e->getCode());
        }
    }

    public function toggleStatus(Request $request): \support\Response
    {
        $id = max(0, (int)$request->post('id', 0));
        $status = (int)$request->post('status', -1);
        if ($id <= 0) {
            return $this->fail('文章ID不能为空', 422);
        }

        try {
            return $this->ok($this->service->toggleStatus($id, $status), '操作成功');
        } catch (ServiceException $e) {
            return $this->fail($e->getMessage(), $e->getCode());
        }
    }
}
