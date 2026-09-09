<?php

namespace app\command;

use app\model\CommonMedicineModel;
use app\model\InsertMedicinesInfoModel;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand('medicine:thumb-sync', '同步常用药图片到 tb_common_medicine')]
class CommonMedicineThumbSync extends Command
{
    protected function configure(): void
    {
        $this->addArgument('id', InputArgument::OPTIONAL, '指定常用药ID');
        $this->addOption('limit', null, InputOption::VALUE_OPTIONAL, '批量处理数量', 100);
        $this->addOption('force', null, InputOption::VALUE_NONE, '即使已有图片也强制覆盖');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $force = (bool)$input->getOption('force');
        $id = $input->getArgument('id');
        $limit = max(1, (int)$input->getOption('limit'));

        if ($id !== null) {
            return $this->syncOne((int)$id, $force, $output);
        }

        $query = CommonMedicineModel::query()->orderBy('id');
        if (!$force) {
            $query->where(function ($builder) {
                $builder->whereNull('thumb')
                    ->orWhere('thumb', '');
            });
        }

        $commonMedicines = $query->limit($limit)->get(['id', 'ybm', 'thumb']);
        if ($commonMedicines->isEmpty()) {
            $output->writeln('<info>没有需要处理的常用药记录</info>');
            return self::SUCCESS;
        }

        $ybms = $commonMedicines->pluck('ybm')
            ->filter(fn($ybm) => trim((string)$ybm) !== '')
            ->map(fn($ybm) => trim((string)$ybm))
            ->unique()
            ->values()
            ->all();

        $thumbMap = [];
        if (!empty($ybms)) {
            $thumbMap = InsertMedicinesInfoModel::query()
                ->whereIn('ybm', $ybms)
                ->get(['ybm', 'thumb'])
                ->filter(fn($item) => trim((string)$item->ybm) !== '' && trim((string)$item->thumb) !== '')
                ->mapWithKeys(fn($item) => [
                    trim((string)$item->ybm) => (string)$item->thumb,
                ])
                ->toArray();
        }

        $success = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($commonMedicines as $medicine) {
            try {
                $ybm = trim((string)$medicine->ybm);
                if ($ybm === '') {
                    $skipped++;
                    $output->writeln("<comment>[跳过]</comment> ID {$medicine->id} 缺少 ybm");
                    continue;
                }

                $thumb = $thumbMap[$ybm] ?? '';
                if ($thumb === '') {
                    $skipped++;
                    $output->writeln("<comment>[跳过]</comment> ID {$medicine->id} 未匹配到图片");
                    continue;
                }

                $medicine->thumb = $thumb;
                $medicine->save();
                $success++;
                $output->writeln("<info>[成功]</info> ID {$medicine->id} 已同步图片");
            } catch (\Throwable $e) {
                $failed++;
                $output->writeln("<error>[失败]</error> ID {$medicine->id} {$e->getMessage()}</error>");
            }
        }

        $output->writeln(sprintf(
            '<info>执行完成：成功 %d 条，跳过 %d 条，失败 %d 条</info>',
            $success,
            $skipped,
            $failed
        ));

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    private function syncOne(int $id, bool $force, OutputInterface $output): int
    {
        $medicine = CommonMedicineModel::query()->find($id);
        if (!$medicine) {
            $output->writeln("<error>ID {$id} 常用药不存在</error>");
            return self::FAILURE;
        }

        if (!$force && trim((string)$medicine->thumb) !== '') {
            $output->writeln("<comment>ID {$id} 已有图片，跳过</comment>");
            return self::SUCCESS;
        }

        $ybm = trim((string)$medicine->ybm);
        if ($ybm === '') {
            $output->writeln("<error>ID {$id} 缺少 ybm</error>");
            return self::FAILURE;
        }

        $medicineInfo = InsertMedicinesInfoModel::query()
            ->where('ybm', $ybm)
            ->first(['thumb']);

        $thumb = $medicineInfo ? trim((string)$medicineInfo->thumb) : '';
        if ($thumb === '') {
            $output->writeln("<comment>ID {$id} 未匹配到图片</comment>");
            return self::SUCCESS;
        }

        $medicine->thumb = $thumb;
        $medicine->save();

        $output->writeln("<info>ID {$id} 已同步图片</info>");
        return self::SUCCESS;
    }
}
