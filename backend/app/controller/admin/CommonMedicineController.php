<?php

namespace app\controller\admin;

use app\exception\ServiceException;
use app\services\admin\CommonMedicineService;
use support\Request;

class CommonMedicineController extends AdminBaseController
{
    public function __construct(
        private readonly CommonMedicineService $service = new CommonMedicineService()
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

    public function toggleStatus(Request $request): \support\Response
    {
        $id = max(0, (int)$request->post('id', 0));
        $status = (int)$request->post('status', -1);
        if ($id <= 0) {
            return $this->fail('常用药品ID不能为空', 422);
        }

        try {
            return $this->ok($this->service->toggleStatus($id, $status), '操作成功');
        } catch (ServiceException $e) {
            return $this->fail($e->getMessage(), $e->getCode());
        }
    }
}
