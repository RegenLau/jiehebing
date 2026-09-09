<?php

namespace app\services\admin;

use app\exception\ServiceException;
use app\model\CommonMedicineModel;

class CommonMedicineService
{
    public function getList(int $current, int $size, string $keyword = '', string $status = ''): array
    {
        $query = CommonMedicineModel::query()->orderBy('sort_order')->orderByDesc('id');

        if ($keyword !== '') {
            $query->where(function ($builder) use ($keyword) {
                $builder->where('common_name', 'like', '%' . $keyword . '%')
                    ->orWhere('company', 'like', '%' . $keyword . '%')
                    ->orWhere('ybm', 'like', '%' . $keyword . '%');
            });
        }

        if ($status !== '') {
            $query->where('status', (int)$status);
        }

        $paginator = $query->paginate(
            $size,
            [
                'id',
                'common_name',
                'company',
                'specification',
                'ybm',
                'usage',
                'frequency',
                'dosage',
                'dosage_value',
                'dosage_unit',
                'medication_guidance',
                'thumb',
                'sort_order',
                'status',
                'created_at',
                'updated_at',
            ],
            'current',
            $current
        );

        $list = collect($paginator->items())
            ->map(fn(CommonMedicineModel $item) => [
                'id'                  => (int)$item->id,
                'common_name'         => (string)$item->common_name,
                'company'             => (string)($item->company ?? ''),
                'specification'       => (string)($item->specification ?? ''),
                'ybm'                 => (string)($item->ybm ?? ''),
                'usage'               => (string)($item->usage ?? ''),
                'frequency'           => (int)($item->frequency ?? 0),
                'dosage'              => (string)($item->dosage ?? ''),
                'dosage_value'        => (string)($item->dosage_value ?? ''),
                'dosage_unit'         => (string)($item->dosage_unit ?? ''),
                'medication_guidance' => (string)($item->medication_guidance ?? ''),
                'thumb'               => (string)($item->thumb ?? ''),
                'sort_order'          => (int)($item->sort_order ?? 0),
                'status'              => (int)($item->status ?? 0),
                'status_text'         => (int)($item->status ?? 0) === 1 ? '启用' : '停用',
                'created_at'          => (string)($item->created_at ?? ''),
                'updated_at'          => (string)($item->updated_at ?? ''),
            ])
            ->values()
            ->toArray();

        return [
            'list'    => $list,
            'total'   => $paginator->total(),
            'current' => $paginator->currentPage(),
            'size'    => $paginator->perPage(),
        ];
    }

    public function toggleStatus(int $id, int $status): array
    {
        if (!in_array($status, [0, 1], true)) {
            throw new ServiceException('状态值不合法', 422);
        }

        $medicine = CommonMedicineModel::query()->find($id);
        if (!$medicine) {
            throw new ServiceException('常用药品不存在', 404);
        }

        $medicine->status = $status;
        $medicine->save();

        return [
            'id'     => (int)$medicine->id,
            'status' => (int)$medicine->status,
        ];
    }
}
