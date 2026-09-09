<?php

namespace app\services\medicine;

use app\exception\ServiceException;
use app\model\CommonMedicineModel;
use app\model\InsertMedicinesInfoModel;
use app\model\InsertMedicinesInstructionModel;

class MedicineService
{
    /**
     * 常用药列表（分页 + 搜索）
     */
    public function commonList(array $params): array
    {
        $page     = max(1, (int)($params['page'] ?? 1));
        $pageSize = max(1, min(100, (int)($params['page_size'] ?? 20)));
        $keyword  = trim((string)($params['keyword'] ?? ''));

        $query = CommonMedicineModel::query()
            ->where('status', 1);

        if ($keyword !== '') {
            $query->where(function ($q) use ($keyword) {
                $q->where('common_name', 'like', "%{$keyword}%")
                    ->orWhere('company', 'like', "%{$keyword}%");
            });
        }

        $paginator = $query->orderBy('sort_order')
            ->paginate($pageSize, [
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
            ], 'page', $page);

        $list = collect($paginator->items())->map(fn($item) => [
            'id'                 => (int)$item->id,
            'commonName'         => (string)$item->common_name,
            'company'            => (string)$item->company,
            'specification'      => (string)$item->specification,
            'ybm'                => (string)$item->ybm,
            'usage'              => (string)($item->usage ?? ''),
            'frequency'          => (int)($item->frequency ?? 1),
            'dosage'             => (string)($item->dosage ?? ''),
            'dosage_value'       => (string)($item->dosage_value ?? ''),
            'dosage_unit'        => (string)($item->dosage_unit ?? ''),
            'medication_guidance' => (string)($item->medication_guidance ?? ''),
            'thumb'              => $item->thumb ? (string)$item->thumb : '',
        ])->toArray();

        return [
            'list'         => $list,
            'total'        => $paginator->total(),
            'per_page'     => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page'    => $paginator->lastPage(),
        ];
    }

    /**
     * 常用药详情（含药品说明书）
     */
    public function commonDetail(int $id): array
    {
        $medicine = CommonMedicineModel::query()->find($id);
        if (!$medicine) {
            throw new ServiceException('药品不存在');
        }

        return [
            'id'                 => (int)$medicine->id,
            'commonName'         => (string)$medicine->common_name,
            'company'            => (string)$medicine->company,
            'specification'      => (string)$medicine->specification,
            'usage'              => (string)($medicine->usage ?? ''),
            'frequency'          => (int)($medicine->frequency ?? 1),
            'dosage'             => (string)($medicine->dosage ?? ''),
            'dosage_value'       => (string)($medicine->dosage_value ?? ''),
            'dosage_unit'        => (string)($medicine->dosage_unit ?? ''),
            'thumb'              => $medicine->thumb ? (string)$medicine->thumb : '',
            'medication_guidance' => (string)($medicine->medication_guidance ?? ''),
            'instruction'        => [],
        ];

//        $instructionId = $this->findInstructionIdByYbm((string)$medicine->ybm);
//        if ($instructionId > 0) {
//            $instruction = InsertMedicinesInstructionModel::query()->find($instructionId);
//            if ($instruction) {
//                $result['instruction'] = $this->formatInstruction($instruction);
//            }
//        }
//
//        return $result;
    }

    /**
     * 格式化说明书
     * 按 fullVersionIndex 顺序组织，key 对应的内容作为 value，displayNameMap 提供中文标题
     */
    private function formatInstruction(InsertMedicinesInstructionModel $instruction): array
    {
        // 解析 fullVersionIndex（有序 key 列表）
        $fullVersionIndex = json_decode($instruction->fullVersionIndex, true);
        if (!is_array($fullVersionIndex)) {
            $fullVersionIndex = [];
        }

        // 解析 displayNameMap（key -> 中文标题映射）
        $displayNameMap = json_decode($instruction->displayNameMap, true);
        if (!is_array($displayNameMap)) {
            $displayNameMap = [];
        }

        // 需要展示的正文内容字段（排除元数据）
        $contentKeys = [
            'drugName', 'ingredients', 'characters', 'functionCategory', 'indication',
            'spec', 'dosage', 'adverseReaction', 'contraindication', 'precaution',
            'warnings', 'warningsPregnancy', 'warningsChildren', 'warningsOlder', 'warningsSpecial',
            'interaction', 'overUse', 'clinicalResearch', 'toxicology', 'dmpk',
            'storage', 'packageMethod', 'expireDate', 'executiveStandard',
        ];

        $sections = [];
        foreach ($fullVersionIndex as $key) {
            if (!in_array($key, $contentKeys, true)) {
                continue;
            }
            $value = $instruction->$key;
            // 跳过空值
            if (empty($value) || trim(strip_tags((string)$value)) === '') {
                continue;
            }
            $sections[] = [
                'key'   => $key,
                'title' => $displayNameMap[$key] ?? $key,
                'value' => (string)$value,
            ];
        }

        return $sections;
    }

    private function findInstructionIdByYbm(string $ybm): int
    {
        $ybm = trim($ybm);
        if ($ybm === '') {
            return 0;
        }

        $medicineInfo = InsertMedicinesInfoModel::query()
            ->where('ybm', $ybm)
            ->first(['medicine_instruction_id']);

        return $medicineInfo ? (int)$medicineInfo->medicine_instruction_id : 0;
    }
}
