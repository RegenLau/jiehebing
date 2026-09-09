<?php

namespace app\controller\admin;

use app\services\admin\MedicationPlanService;
use support\Request;

class MedicationPlanController extends AdminBaseController
{
    public function __construct(
        private readonly MedicationPlanService $service = new MedicationPlanService()
    ) {
    }

    public function index(Request $request): \support\Response
    {
        $current     = max(1, (int)$request->get('current', 1));
        $size        = max(1, min(100, (int)$request->get('size', 10)));
        $patientName = trim((string)$request->get('patient_name', ''));
        $planDate    = trim((string)$request->get('plan_date', ''));
        $userId      = max(0, (int)$request->get('user_id', 0));
        $scope       = trim((string)$request->get('scope', 'today'));
        $status      = $request->get('status');
        $status      = in_array((string)$status, ['0', '1'], true) ? (int)$status : null;
        $overdue     = in_array((string)$request->get('overdue', ''), ['1', 'true'], true);
        $overdueRange = trim((string)$request->get('overdue_range', ''));
        $overdueRange = in_array($overdueRange, ['7d', '30d'], true) ? $overdueRange : '';

        return $this->ok($this->service->getList($current, $size, $patientName, $planDate, $userId, $scope, $status, $overdue, $overdueRange));
    }
}
