<?php

namespace app\command;

use app\model\CommonMedicineModel;
use app\model\InsertMedicinesInfoModel;
use app\model\InsertMedicinesInstructionModel;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand('medicine:cleanup-unused', '清理 tb_insert_medicines_info 和 tb_insert_medicines_instruction 中未被常用药使用的数据')]
class CleanupUnusedMedicineData extends Command
{
    protected function configure(): void
    {
        $this->addOption('force', null, InputOption::VALUE_NONE, '实际执行删除；默认仅预览');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $execute = (bool)$input->getOption('force');

        $usedYbms = CommonMedicineModel::query()
            ->whereNotNull('ybm')
            ->where('ybm', '<>', '')
            ->pluck('ybm')
            ->map(fn($ybm) => trim((string)$ybm))
            ->filter(fn($ybm) => $ybm !== '')
            ->unique()
            ->values()
            ->all();

        $unusedInfoQuery = InsertMedicinesInfoModel::query();
        if (!empty($usedYbms)) {
            $unusedInfoQuery->whereNotIn('ybm', $usedYbms);
        }

        $unusedInfoIds = $unusedInfoQuery->pluck('id')->map(fn($id) => (int)$id)->all();
        $unusedInfoCount = count($unusedInfoIds);

        $usedInstructionIds = [];
        if (!empty($usedYbms)) {
            $usedInstructionIds = InsertMedicinesInfoModel::query()
                ->whereIn('ybm', $usedYbms)
                ->whereNotNull('medicine_instruction_id')
                ->pluck('medicine_instruction_id')
                ->map(fn($id) => (int)$id)
                ->filter(fn($id) => $id > 0)
                ->unique()
                ->values()
                ->all();
        }

        $unusedInstructionQuery = InsertMedicinesInstructionModel::query();
        if (!empty($usedInstructionIds)) {
            $unusedInstructionQuery->whereNotIn('id', $usedInstructionIds);
        }

        $unusedInstructionIds = $unusedInstructionQuery->pluck('id')->map(fn($id) => (int)$id)->all();
        $unusedInstructionCount = count($unusedInstructionIds);

        $output->writeln('<info>清理预览</info>');
        $output->writeln("常用药使用中的 ybm 数量: " . count($usedYbms));
        $output->writeln("待清理 tb_insert_medicines_info 数量: {$unusedInfoCount}");
        $output->writeln("待清理 tb_insert_medicines_instruction 数量: {$unusedInstructionCount}");

        if (!$execute) {
            $output->writeln('<comment>当前为预览模式，添加 --force 后执行删除</comment>');
            return self::SUCCESS;
        }

        $deletedInfoCount = 0;
        if ($unusedInfoCount > 0) {
            $deletedInfoCount = InsertMedicinesInfoModel::query()
                ->whereIn('id', $unusedInfoIds)
                ->delete();
        }

        $deletedInstructionCount = 0;
        if ($unusedInstructionCount > 0) {
            $deletedInstructionCount = InsertMedicinesInstructionModel::query()
                ->whereIn('id', $unusedInstructionIds)
                ->delete();
        }

        $output->writeln('<info>删除完成</info>');
        $output->writeln("已删除 tb_insert_medicines_info: {$deletedInfoCount}");
        $output->writeln("已删除 tb_insert_medicines_instruction: {$deletedInstructionCount}");
        $output->writeln('<comment>注意：当前模型启用了 SoftDeletes，上述删除为软删除</comment>');

        return self::SUCCESS;
    }
}
