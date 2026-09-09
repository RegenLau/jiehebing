<?php

namespace app\command;

use app\services\ai\AliDifyService;
use app\services\patient\PatientArchiveService;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand('ocr:test', 'ocr test')]
class OcrTest extends Command
{
    protected function configure(): void
    {
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $service = new PatientArchiveService();
        $aliService = new AliDifyService();

        $image = 'https://health-h5.oss-cn-beijing.aliyuncs.com/tb-follow/7007029eda20fceda8dff2bc41978410.png';
        $result = $aliService->ocr($image);
        //print_r($result);

        $data =  [
            'url'       => $image,
            'medicines' => $service->normalizeRecognizedMedicines($result ?? []),
        ];

        print_r($data);

        $output->writeln('<info>Hello</info> <comment>' . $this->getName() . '</comment>');
        return self::SUCCESS;
    }
}
