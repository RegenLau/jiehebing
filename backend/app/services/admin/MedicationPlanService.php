<?php

namespace app\services\admin;

use support\Db;

class MedicationPlanService
{
    public function getList(
        int $current,
        int $size,
        string $patientName = '',
        string $planDate = '',
        int $userId = 0,
        string $scope = 'today',
        ?int $status = null,
        bool $overdue = false,
        string $overdueRange = ''
    ): array
    {
        $query = Db::table('tb_user_medication_plan as p')
            ->leftJoin('tb_user as u', 'u.id', '=', 'p.user_id')
            ->leftJoin('tb_user_medicine as m', 'm.id', '=', 'p.medicine_id')
            ->whereNull('p.deleted_at')
            ->orderByDesc('p.plan_date')
            ->orderBy('p.plan_time')
            ->orderByDesc('p.id');

        if ($patientName !== '') {
            $query->where('u.name', 'like', '%' . $patientName . '%');
        }

        if ($userId > 0) {
            $query->where('p.user_id', $userId);
        }

        if ($scope === 'today') {
            $query->whereDate('p.plan_date', date('Y-m-d'));
        }

        if ($overdue) {
            $query->whereDate('p.plan_date', '<', date('Y-m-d'));
            if ($overdueRange !== '') {
                $days = $overdueRange === '7d' ? 7 : 30;
                $query->whereDate('p.plan_date', '>=', date('Y-m-d', strtotime('-' . ($days - 1) . ' days')));
            }
        }

        if ($planDate !== '') {
            $query->whereDate('p.plan_date', $planDate);
        }

        if ($status !== null) {
            $query->where('p.status', $status);
        }

        $paginator = $query
            ->paginate(
                $size,
                [
                    'p.id',
                    'p.user_id',
                    'p.medicine_id',
                    'p.plan_date',
                    'p.day_number',
                    'p.plan_time',
                    'p.plan_index',
                    'p.name',
                    'p.specification',
                    'p.usage',
                    'p.frequency',
                    'p.dosage',
                    'p.dosage_value',
                    'p.dosage_unit',
                    'p.status',
                    'p.checked_at',
                    'p.created_at',
                    'u.name as patient_name',
                    'u.mobile as patient_mobile',
                    'm.batch_no as batch_no',
                ],
                'current',
                $current
            );

        $list = collect($paginator->items())
            ->map(fn($item) => [
                'id'             => (int)$item->id,
                'user_id'        => (int)$item->user_id,
                'medicine_id'    => (int)$item->medicine_id,
                'patient_name'   => (string)($item->patient_name ?? ''),
                'patient_mobile' => (string)($item->patient_mobile ?? ''),
                'batch_no'       => (string)($item->batch_no ?? ''),
                'plan_date'      => (string)$item->plan_date,
                'day_number'     => (int)$item->day_number,
                'plan_time'      => (string)($item->plan_time ?? ''),
                'plan_index'     => (int)($item->plan_index ?? 1),
                'name'           => (string)$item->name,
                'specification'  => (string)$item->specification,
                'usage'          => (string)$item->usage,
                'frequency'      => (int)$item->frequency,
                'dosage'         => (string)$item->dosage,
                'dosage_value'   => (string)($item->dosage_value ?? ''),
                'dosage_unit'    => (string)($item->dosage_unit ?? ''),
                'status'         => (int)$item->status,
                'status_text'    => (int)$item->status === 1 ? '已打卡' : '待打卡',
                'checked_at'     => $item->checked_at ? (string)$item->checked_at : '',
                'created_at'     => (string)($item->created_at ?? ''),
            ])
            ->values()
            ->toArray();

        return [
            'list'    => $list,
            'total'   => $paginator->total(),
            'current' => $paginator->currentPage(),
            'size'    => $paginator->perPage(),
            'scope'   => $scope,
        ];
    }
}
