<?php

namespace app\controller\admin;

use app\services\admin\AdverseReactionService;
use support\Request;
use Throwable;

class AdverseReactionController extends AdminBaseController
{
    public function __construct(
        private readonly AdverseReactionService $service = new AdverseReactionService()
    ) {
    }

    public function index(Request $request): \support\Response
    {
        $current     = max(1, (int)$request->get('current', 1));
        $size        = max(1, min(100, (int)$request->get('size', 10)));
        $patientName = trim((string)$request->get('patient_name', ''));
        $userId      = max(0, (int)$request->get('user_id', 0));
        $severity    = max(0, (int)$request->get('severity', 0));

        return $this->ok($this->service->getList($current, $size, $patientName, $userId, $severity));
    }

    public function export(Request $request): \support\Response
    {
        $patientName = trim((string)$request->get('patient_name', ''));
        $userId      = max(0, (int)$request->get('user_id', 0));
        $severity    = max(0, (int)$request->get('severity', 0));

        try {
            $exportFile = $this->service->exportExcel($patientName, $userId, $severity);

            return response()->download($exportFile['file_path'], $exportFile['file_name']);
        } catch (Throwable $exception) {
            return $this->fail('导出失败：' . $exception->getMessage(), 500);
        }
    }
}
