<?php

namespace app\services\admin;

use support\Db;
use Vtiful\Kernel\Excel;

class AdverseReactionService
{
    public function getList(
        int $current,
        int $size,
        string $patientName = '',
        int $userId = 0,
        int $severity = 0
    ): array
    {
        $query = $this->buildQuery($patientName, $userId, $severity);

        $paginator = $query->paginate(
            $size,
            $this->selectFields(),
            'current',
            $current
        );

        $list = collect($paginator->items())
            ->map(fn ($item) => $this->normalizeRecord($item))
            ->values()
            ->toArray();

        return [
            'list'    => $list,
            'total'   => $paginator->total(),
            'current' => $paginator->currentPage(),
            'size'    => $paginator->perPage(),
        ];
    }

    public function exportExcel(
        string $patientName = '',
        int $userId = 0,
        int $severity = 0
    ): array
    {
        $records = $this->buildQuery($patientName, $userId, $severity)
            ->get($this->selectFields());

        $rows = collect($records)
            ->map(fn ($item) => $this->normalizeRecord($item))
            ->map(fn (array $item) => [
                $item['id'],
                $item['patient_name'],
                $item['patient_mobile'],
                $item['occurred_at'],
                $item['symptom_summary'],
                $item['symptom_description'],
                $item['severity_text'],
                $item['advice_text'],
                $item['status_text'],
                $item['created_at'],
            ])
            ->values()
            ->toArray();

        $exportDir = base_path() . '/runtime/exports';
        if (!is_dir($exportDir)) {
            mkdir($exportDir, 0777, true);
        }

        $storedFileName = sprintf('adverse_reaction_%s_%s.xlsx', date('Ymd_His'), substr(md5((string)microtime(true)), 0, 6));
        $downloadFileName = sprintf('adverse_reaction_%s.xlsx', date('Ymd_His'));

        $filePath = (new Excel(['path' => $exportDir]))
            ->fileName($storedFileName, '不良反应记录')
            ->header([
                'ID',
                '患者姓名',
                '手机号',
                '发生时间',
                '主要症状',
                '症状描述',
                '严重程度',
                '处理建议',
                '状态',
                '上报时间',
            ])
            ->setColumn('A:D', 18)
            ->setColumn('E:F', 36)
            ->setColumn('G:J', 18)
            ->data($rows)
            ->output();

        return [
            'file_path' => $filePath,
            'file_name' => $downloadFileName,
        ];
    }

    private function buildQuery(string $patientName = '', int $userId = 0, int $severity = 0)
    {
        $query = Db::table('tb_user_adverse_reaction_report as r')
            ->leftJoin('tb_user as u', 'u.id', '=', 'r.user_id')
            ->whereNull('r.deleted_at')
            ->orderByDesc('r.occurred_at')
            ->orderByDesc('r.id');

        if ($patientName !== '') {
            $query->where('u.name', 'like', '%' . $patientName . '%');
        }

        if ($userId > 0) {
            $query->where('r.user_id', $userId);
        }

        if (in_array($severity, [1, 2, 3], true)) {
            $query->where('r.severity', $severity);
        }

        return $query;
    }

    private function selectFields(): array
    {
        return [
            'r.id',
            'r.user_id',
            'r.occurred_at',
            'r.symptoms',
            'r.symptom_description',
            'r.severity',
            'r.severity_text',
            'r.advice_text',
            'r.status',
            'r.created_at',
            'u.name as patient_name',
            'u.mobile as patient_mobile',
        ];
    }

    private function normalizeRecord(object $item): array
    {
        $symptoms = json_decode((string)($item->symptoms ?? '[]'), true);
        $symptomList = is_array($symptoms) ? array_values(array_filter($symptoms, 'is_string')) : [];

        return [
            'id'                  => (int)$item->id,
            'user_id'             => (int)$item->user_id,
            'patient_name'        => (string)($item->patient_name ?? ''),
            'patient_mobile'      => (string)($item->patient_mobile ?? ''),
            'occurred_at'         => (string)($item->occurred_at ?? ''),
            'symptoms'            => $symptomList,
            'symptom_summary'     => implode('、', $symptomList),
            'symptom_description' => (string)($item->symptom_description ?? ''),
            'severity'            => (int)$item->severity,
            'severity_text'       => (string)($item->severity_text ?? ''),
            'advice_text'         => (string)($item->advice_text ?? ''),
            'status'              => (int)($item->status ?? 0),
            'status_text'         => (int)($item->status ?? 0) === 1 ? '已上报' : '已处理',
            'created_at'          => (string)($item->created_at ?? ''),
        ];
    }
}
