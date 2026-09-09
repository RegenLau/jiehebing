<?php

namespace app\controller\admin;

use DateInterval;
use DatePeriod;
use DateTimeImmutable;
use support\Db;
use support\Request;

class DashboardController extends AdminBaseController
{
    public function overview(Request $request): \support\Response
    {
        $range = (string)$request->get('range', 'today');
        $date = trim((string)$request->get('date', ''));
        if (!in_array($range, ['today', '7d', '30d'], true)) {
            $range = 'today';
        }
        $days = match ($range) {
            '7d' => 7,
            '30d' => 30,
            default => 1,
        };
        try {
            $today = $date === '' ? new DateTimeImmutable('today') : new DateTimeImmutable($date);
        } catch (\Exception) {
            $today = new DateTimeImmutable('today');
        }
        $start = $today->sub(new DateInterval('P' . ($days - 1) . 'D'));
        $labels = [];
        $expected = [];
        $completed = [];
        $trend = [];

        foreach (new DatePeriod($start, new DateInterval('P1D'), $today->modify('+1 day')) as $date) {
            $dateKey = $date->format('Y-m-d');
            $labels[] = $date->format('m-d');
            $trend[$dateKey] = ['expected' => 0, 'completed' => 0];
        }

        $planRows = Db::table('tb_user_medication_plan')
            ->selectRaw('DATE(plan_date) as plan_date, COUNT(*) as expected, SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as completed')
            ->whereNull('deleted_at')
            ->whereBetween('plan_date', [$start->format('Y-m-d'), $today->format('Y-m-d')])
            ->groupByRaw('DATE(plan_date)')
            ->get();

        foreach ($planRows as $row) {
            $dateKey = (string)$row->plan_date;
            if (isset($trend[$dateKey])) {
                $trend[$dateKey] = [
                    'expected' => (int)$row->expected,
                    'completed' => (int)$row->completed,
                ];
            }
        }

        foreach ($trend as $item) {
            $expected[] = $item['expected'];
            $completed[] = $item['completed'];
        }

        $severityRows = Db::table('tb_user_adverse_reaction_report')
            ->selectRaw('severity, COUNT(*) as total')
            ->whereNull('deleted_at')
            ->whereBetween('occurred_at', [$start->format('Y-m-d 00:00:00'), $today->format('Y-m-d 23:59:59')])
            ->groupBy('severity')
            ->pluck('total', 'severity');

        $expectedTotal = array_sum($expected);
        $completedTotal = array_sum($completed);
        $patientTotal = Db::table('tb_user')->whereNull('deleted_at')->count();
        $archivedTotal = Db::table('tb_user')->whereNull('deleted_at')->where('is_archived', 1)->count();
        $newAdverseTotal = array_sum(array_map('intval', $severityRows->all()));
        $overdueQuery = Db::table('tb_user_medication_plan')
            ->whereNull('deleted_at')
            ->where('status', 0)
            ->whereDate('plan_date', '<', $today->format('Y-m-d'));
        if ($range !== 'today') {
            $overdueQuery->whereDate('plan_date', '>=', $start->format('Y-m-d'));
        }
        $overdueTotal = $overdueQuery->count();

        return $this->ok([
            'range' => $range,
            'date' => $today->format('Y-m-d'),
            'metrics' => [
                'patient_total' => $patientTotal,
                'archived_total' => $archivedTotal,
                'expected_total' => $expectedTotal,
                'completed_total' => $completedTotal,
                'new_adverse_total' => $newAdverseTotal,
            ],
            'archive' => [
                'archived' => $archivedTotal,
                'unarchived' => max(0, $patientTotal - $archivedTotal),
            ],
            'resources' => [
                'survey_total' => Db::table('tb_survey_template')->count(),
                'article_total' => Db::table('tb_health_article')->whereNull('deleted_at')->count(),
                'medicine_total' => Db::table('tb_common_medicine')->count(),
            ],
            'todos' => [
                'overdue_total' => $overdueTotal,
                'pending_review_total' => $newAdverseTotal,
            ],
            'trend' => [
                'labels' => $labels,
                'expected' => $expected,
                'completed' => $completed,
            ],
            'adverse_severity' => [
                'mild' => (int)($severityRows[1] ?? 0),
                'moderate' => (int)($severityRows[2] ?? 0),
                'severe' => (int)($severityRows[3] ?? 0),
            ],
        ]);
    }
}
