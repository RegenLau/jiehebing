<?php

namespace app\command;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use support\Db;

#[AsCommand('medicine:common-import', '从 tb_medicines 导入常用药品')]
class CommonMedicineImport extends Command
{
    protected function configure(): void
    {
        $this->addOption('dry-run', null, InputOption::VALUE_NONE, '仅预览，不写入数据');
        $this->addOption('limit', null, InputOption::VALUE_OPTIONAL, '最多处理数量，0 表示全部', 0);
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $schema = Db::getSchemaBuilder();
        if (!$schema->hasTable('tb_medicines')) {
            $output->writeln('<error>未找到来源表 tb_medicines</error>');
            return self::FAILURE;
        }
        if (!$schema->hasTable('tb_common_medicine')) {
            $output->writeln('<error>未找到目标表 tb_common_medicine</error>');
            return self::FAILURE;
        }

        $sourceColumns = $schema->getColumnListing('tb_medicines');
        if (!in_array('ybm', $sourceColumns, true)) {
            $output->writeln('<error>来源表 tb_medicines 缺少 ybm 字段</error>');
            return self::FAILURE;
        }

        $sourceFieldMap = $this->fieldMap($sourceColumns);
        $sourceSelects = ['ybm'];
        foreach ($sourceFieldMap as $field => $column) {
            if ($column !== null) {
                $sourceSelects[] = "{$column} as {$field}";
            }
        }

        $query = Db::table('tb_medicines')
            ->select($sourceSelects)
            ->whereNotNull('ybm')
            ->where('ybm', '<>', '')
            ->orderBy('ybm');
        $limit = max(0, (int)$input->getOption('limit'));
        if ($limit > 0) {
            $query->limit($limit);
        }
        $sourceRows = $query->get()->unique(fn($row) => trim((string)$row->ybm))->values();
        if ($sourceRows->isEmpty()) {
            $output->writeln('<info>tb_medicines 中没有可导入的医保码</info>');
            return self::SUCCESS;
        }

        $ybms = $sourceRows->pluck('ybm')->map(fn($ybm) => trim((string)$ybm))->all();
        $existingMedicines = Db::table('tb_common_medicine')
            ->whereIn('ybm', $ybms)
            ->get(['id', 'ybm', 'common_name', 'company', 'specification', 'thumb'])
            ->mapWithKeys(fn($medicine) => [trim((string)$medicine->ybm) => $medicine])
            ->all();
        $detailMap = $this->detailMap($schema->hasTable('tb_insert_medicines_info'), $ybms);

        $now = date('Y-m-d H:i:s');
        $records = [];
        $updates = [];
        $skipped = 0;
        $missingDetail = 0;
        foreach ($sourceRows as $source) {
            $ybm = trim((string)$source->ybm);
            $detail = $detailMap[$ybm] ?? [];
            $commonName = $this->fieldValue($source, 'common_name') ?: ($detail['common_name'] ?? '');
            $company = $this->fieldValue($source, 'company') ?: ($detail['company'] ?? '');
            $specification = $this->fieldValue($source, 'specification') ?: ($detail['specification'] ?? '');
            $thumb = $this->fieldValue($source, 'thumb') ?: ($detail['thumb'] ?? '');

            if (isset($existingMedicines[$ybm])) {
                $existing = $existingMedicines[$ybm];
                $payload = [];
                foreach ([
                    'common_name' => $commonName,
                    'company' => $company,
                    'specification' => $specification,
                    'thumb' => $thumb,
                ] as $field => $value) {
                    if (trim((string)$existing->{$field}) === '' && $value !== '') {
                        $payload[$field] = $value;
                    }
                }
                if (empty($payload)) {
                    $skipped++;
                    continue;
                }
                $payload['updated_at'] = $now;
                $updates[(int)$existing->id] = $payload;
                continue;
            }

            if ($commonName === '') {
                $missingDetail++;
                $skipped++;
                continue;
            }

            $records[] = [
                'ybm' => $ybm,
                'common_name' => $commonName,
                'company' => $company,
                'specification' => $specification,
                'thumb' => $thumb,
                'status' => 1,
                'sort_order' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        $output->writeln(sprintf(
            '来源 %d 条，已跳过 %d 条，待插入 %d 条，待补充 %d 条，未匹配通用名 %d 条',
            $sourceRows->count(),
            $skipped,
            count($records),
            count($updates),
            $missingDetail
        ));
        if (empty($records) && empty($updates)) {
            $output->writeln('<info>没有需要导入的数据</info>');
            return self::SUCCESS;
        }
        if ((bool)$input->getOption('dry-run')) {
            $output->writeln('<comment>预览完成，未写入数据</comment>');
            return self::SUCCESS;
        }

        Db::transaction(function () use ($records, $updates) {
            foreach (array_chunk($records, 500) as $chunk) {
                Db::table('tb_common_medicine')->insert($chunk);
            }
            foreach ($updates as $id => $payload) {
                Db::table('tb_common_medicine')->where('id', $id)->update($payload);
            }
        });
        $output->writeln(sprintf(
            '<info>导入完成，新增 %d 条常用药品，补充 %d 条已有药品</info>',
            count($records),
            count($updates)
        ));

        return self::SUCCESS;
    }

    private function detailMap(bool $hasDetailTable, array $ybms): array
    {
        if (!$hasDetailTable || empty($ybms)) {
            return [];
        }

        $schema = Db::getSchemaBuilder();
        $columns = $schema->getColumnListing('tb_insert_medicines_info');
        $fieldMap = $this->fieldMap($columns);
        $selects = ['ybm'];
        foreach ($fieldMap as $field => $column) {
            if ($column !== null) {
                $selects[] = "{$column} as {$field}";
            }
        }
        $query = Db::table('tb_insert_medicines_info')->select($selects)->whereIn('ybm', $ybms);
        if (in_array('deleted_at', $columns, true)) {
            $query->whereNull('deleted_at');
        }
        if (in_array('id', $columns, true)) {
            $query->orderByDesc('id');
        }

        $details = [];
        foreach ($query->get() as $row) {
            $ybm = trim((string)$row->ybm);
            if ($ybm === '' || isset($details[$ybm])) {
                continue;
            }
            $details[$ybm] = [
                'common_name' => $this->fieldValue($row, 'common_name'),
                'company' => $this->fieldValue($row, 'company'),
                'specification' => $this->fieldValue($row, 'specification'),
                'thumb' => $this->fieldValue($row, 'thumb'),
            ];
        }

        return $details;
    }

    private function fieldMap(array $columns): array
    {
        return [
            'common_name' => $this->firstColumn($columns, ['common_name', 'commonName', 'name']),
            'company' => $this->firstColumn($columns, ['company', 'manufacturer']),
            'specification' => $this->firstColumn($columns, ['specification', 'spec']),
            'thumb' => $this->firstColumn($columns, ['thumb', 'image', 'img']),
        ];
    }

    private function firstColumn(array $columns, array $candidates): ?string
    {
        foreach ($candidates as $candidate) {
            if (in_array($candidate, $columns, true)) {
                return $candidate;
            }
        }

        return null;
    }

    private function fieldValue(object $row, string $field): string
    {
        return isset($row->{$field}) ? trim((string)$row->{$field}) : '';
    }
}
