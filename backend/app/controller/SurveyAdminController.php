<?php

namespace app\controller;

use app\exception\ServiceException;
use app\services\survey\SurveyAdminService;
use Respect\Validation\Exceptions\ValidationException;
use Respect\Validation\Validator as v;
use support\Request;
use support\Response;

/**
 * 问卷后台管理：模板（含题目、选项）的增删改查
 * 复用患者端登录态（LoginMiddleware）
 */
class SurveyAdminController extends BaseController
{
    private SurveyAdminService $service;

    public function __construct()
    {
        $this->service = new SurveyAdminService();
    }

    /**
     * 模板分页列表
     */
    public function list(Request $request): Response
    {
        $params = $request->get();
        $result = $this->service->list($params);
        return json(['code' => 0, 'data' => $result, 'message' => '获取成功']);
    }

    /**
     * 模板详情（完整题目+选项树）
     */
    public function detail(Request $request): Response
    {
        try {
            $data = v::input($request->get(), [
                'id' => v::intVal()->positive()->setName('模板ID'),
            ]);
        } catch (ValidationException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }

        try {
            $result = $this->service->detail((int)$data['id']);
        } catch (ServiceException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }
        return json(['code' => 0, 'data' => $result, 'message' => '获取成功']);
    }

    /**
     * 新建或更新模板（含题目、选项）
     */
    public function save(Request $request): Response
    {
        $payload = $request->post();
        if (!is_array($payload) || empty($payload)) {
            return json(['code' => 1, 'data' => [], 'message' => '请求参数不能为空']);
        }
        // id 可选，存在时须为正整数
        if (isset($payload['id']) && $payload['id'] !== null && $payload['id'] !== '') {
            if (!is_numeric($payload['id']) || (int)$payload['id'] <= 0) {
                return json(['code' => 1, 'data' => [], 'message' => '模板ID不合法']);
            }
            $payload['id'] = (int)$payload['id'];
        } else {
            unset($payload['id']);
        }

        try {
            $result = $this->service->save($payload);
        } catch (ServiceException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }
        return json(['code' => 0, 'data' => $result, 'message' => '保存成功']);
    }

    /**
     * 删除模板
     */
    public function delete(Request $request): Response
    {
        try {
            $data = v::input($request->post(), [
                'id' => v::intVal()->positive()->setName('模板ID'),
            ]);
        } catch (ValidationException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }

        try {
            $result = $this->service->delete((int)$data['id']);
        } catch (ServiceException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }
        return json(['code' => 0, 'data' => $result, 'message' => '删除成功']);
    }

    /**
     * 启用/停用模板
     */
    public function toggleStatus(Request $request): Response
    {
        try {
            $data = v::input($request->post(), [
                'id'     => v::intVal()->positive()->setName('模板ID'),
                'status' => v::intVal()->in([0, 1])->setName('状态'),
            ]);
        } catch (ValidationException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }

        try {
            $result = $this->service->toggleStatus((int)$data['id'], (int)$data['status']);
        } catch (ServiceException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }
        return json(['code' => 0, 'data' => $result, 'message' => '操作成功']);
    }
}
