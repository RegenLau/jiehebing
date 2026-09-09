<?php

namespace app\controller;
use app\services\medicine\MedicineService;
use Respect\Validation\Exceptions\ValidationException;
use Respect\Validation\Validator as v;
use support\Request;
use support\Response;

class MedicineController extends BaseController
{
    private MedicineService $medicineService;

    public function __construct()
    {
        $this->medicineService = new MedicineService();
    }

    /**
     * 常用药列表（分页 + 搜索）
     */
    public function commonList(Request $request): Response
    {
        try {
            $params = v::input($request->post(), [
                'page'      => v::oneOf(v::nullType(), v::intVal()->min(1))->setName('页码'),
                'page_size' => v::oneOf(v::nullType(), v::intVal()->between(1, 100))->setName('每页数量'),
                'keyword'   => v::oneOf(v::nullType(), v::stringType())->setName('搜索关键词'),
            ]);
        } catch (ValidationException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }

        $result = $this->medicineService->commonList($params);
        return json(['code' => 0, 'data' => $result, 'message' => '获取成功']);
    }

    /**
     * 常用药详情（含药品说明书）
     */
    public function commonDetail(Request $request): Response
    {
        try {
            $data = v::input($request->get(), [
                'id' => v::intVal()->positive()->setName('药品ID'),
            ]);
        } catch (ValidationException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }

        $result = $this->medicineService->commonDetail((int)$data['id']);
        return json(['code' => 0, 'data' => $result, 'message' => '获取成功']);
    }
}
