<?php

namespace app\controller;

use app\exception\ServiceException;
use app\services\survey\SurveyService;
use Respect\Validation\Exceptions\ValidationException;
use Respect\Validation\Validator as v;
use support\Request;
use support\Response;

class SurveyController extends BaseController
{
    private SurveyService $surveyService;

    public function __construct()
    {
        $this->surveyService = new SurveyService();
    }

    /**
     * 获取问卷模板列表
     */
    public function templates(): Response
    {
        $result = $this->surveyService->getTemplateList($this->id());
        return json(['code' => 0, 'data' => $result, 'message' => '获取成功']);
    }

    /**
     * 获取问卷（模板 + 题目 + 选项）
     */
    public function detail(Request $request): Response
    {
        try {
            $data = v::input($request->get(), [
                'template_code' => v::stringType()->length(1, 64)->setName('模板编码'),
            ]);
        } catch (ValidationException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }

        try {
            $result = $this->surveyService->getSurvey($data['template_code'], $this->id());
        } catch (ServiceException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }
        return json(['code' => 0, 'data' => $result, 'message' => '获取成功']);
    }

    /**
     * 提交答案
     */
    public function submit(Request $request): Response
    {
        try {
            $data = v::input($request->post(), [
                'template_code' => v::stringType()->length(1, 64)->setName('模板编码'),
                'answers'       => v::arrayType()->length(1, null)->setName('答案'),
            ]);
        } catch (ValidationException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }

        try {
            $result = $this->surveyService->submitAnswers($data['template_code'], $this->id(), $data['answers']);
        } catch (ServiceException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }
        return json(['code' => 0, 'data' => $result, 'message' => '提交成功']);
    }
}
