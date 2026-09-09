<?php

namespace app\controller\admin;

use app\exception\ServiceException;
use app\services\admin\PatientService;
use support\Request;

class PatientController extends AdminBaseController
{
    public function __construct(
        private readonly PatientService $service = new PatientService()
    ) {
    }

    public function index(Request $request): \support\Response
    {
        $current = max(1, (int)$request->get('current', 1));
        $size    = max(1, min(100, (int)$request->get('size', 10)));

        return $this->ok($this->service->getList($current, $size));
    }

    public function detail(Request $request): \support\Response
    {
        $userId = max(0, (int)$request->get('user_id', 0));
        if ($userId <= 0) {
            return $this->fail('患者ID不能为空', 422);
        }

        try {
            return $this->ok($this->service->getDetail($userId));
        } catch (\InvalidArgumentException|ServiceException $e) {
            return $this->fail($e->getMessage(), 404);
        }
    }

    public function surveyStatus(Request $request): \support\Response
    {
        $userId = max(0, (int)$request->get('user_id', 0));
        if ($userId <= 0) {
            return $this->fail('患者ID不能为空', 422);
        }

        try {
            return $this->ok($this->service->getSurveyStatus($userId));
        } catch (\InvalidArgumentException|ServiceException $e) {
            return $this->fail($e->getMessage(), 404);
        }
    }

    public function surveyAnswerDetail(Request $request): \support\Response
    {
        $userId = max(0, (int)$request->get('user_id', 0));
        $templateId = max(0, (int)$request->get('template_id', 0));
        if ($userId <= 0 || $templateId <= 0) {
            return $this->fail('患者ID和问卷ID不能为空', 422);
        }

        try {
            return $this->ok($this->service->getSurveyAnswerDetail($userId, $templateId));
        } catch (\InvalidArgumentException|ServiceException $e) {
            return $this->fail($e->getMessage(), 404);
        }
    }

    public function medicineList(Request $request): \support\Response
    {
        $userId = max(0, (int)$request->get('user_id', 0));
        $current = max(1, (int)$request->get('current', 1));
        $size = max(1, min(100, (int)$request->get('size', 10)));
        if ($userId <= 0) {
            return $this->fail('患者ID不能为空', 422);
        }

        try {
            return $this->ok($this->service->getMedicineList($userId, $current, $size));
        } catch (\InvalidArgumentException|ServiceException $e) {
            return $this->fail($e->getMessage(), 404);
        }
    }
}
