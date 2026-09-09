<?php

namespace app\command;

use app\model\CommonMedicineModel;
use app\services\medicine\CommonMedicineUsageService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand('medicine:usage-sync', '生成并保存常用药用法用量字段')]
class CommonMedicineUsageSync extends Command
{
    protected function configure(): void
    {
        $this->addArgument('id', InputArgument::OPTIONAL, '指定常用药ID');
        $this->addOption('limit', null, InputOption::VALUE_OPTIONAL, '批量处理数量', 20);
        $this->addOption('force', null, InputOption::VALUE_NONE, '即使已有字段也强制重建');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $service = new CommonMedicineUsageService();
        $force = (bool)$input->getOption('force');
        $id = $input->getArgument('id');
        $limit = max(1, (int)$input->getOption('limit'));

        if ($id !== null) {
            return $this->handleOne($service, (int)$id, $force, $output);
        }

        $query = CommonMedicineModel::query()->orderBy('id');
        if (!$force) {
            $query->where(function ($builder) {
                $builder->whereNull('usage')
                    ->orWhere('usage', '')
                    ->orWhereNull('dosage')
                    ->orWhere('dosage', '')
                    ->orWhereNull('dosage_value')
                    ->orWhere('dosage_value', '')
                    ->orWhereNull('dosage_unit')
                    ->orWhere('dosage_unit', '');
            });
        }

        $medicines = $query->limit($limit)->get(['id']);
        if ($medicines->isEmpty()) {
            $output->writeln('<info>没有需要处理的常用药记录</info>');
            return self::SUCCESS;
        }

        $success = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($medicines as $medicine) {
            try {
                $result = $service->generateAndSave((int)$medicine->id, $force);
                if ($result['status'] === 'saved') {
                    $success++;
                    $output->writeln("<info>[成功]</info> ID {$medicine->id} 已保存用法用量字段");
                    continue;
                }
                $skipped++;
                $output->writeln("<comment>[跳过]</comment> ID {$medicine->id} {$result['message']}");
            } catch (\Throwable $e) {
                $failed++;
                $output->writeln("<error>[失败]</error> ID {$medicine->id} {$e->getMessage()}");
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

    private function handleOne(CommonMedicineUsageService $service, int $id, bool $force, OutputInterface $output): int
    {
        try {
            $result = $service->generateAndSave($id, $force);
            $output->writeln("<info>ID {$id} {$result['message']}</info>");
            $output->writeln(json_encode($result, JSON_UNESCAPED_UNICODE));
            return self::SUCCESS;
        } catch (\Throwable $e) {
            $output->writeln("<error>ID {$id} 处理失败：{$e->getMessage()}</error>");
            return self::FAILURE;
        }
    }
}
