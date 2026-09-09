<?php

namespace app\process;

use app\services\wechat\MedicationReminderService;
use support\Log;
use Workerman\Crontab\Crontab;

class MedicationReminderTask
{
    public function onWorkerStart(): void
    {

        new Crontab('0 */1 * * * *', function () {
            try {
                $service = new MedicationReminderService();
                $date = date('Y-m-d');
                $time = date('H:i');
                $result = [
                    'initial' => $service->sendDueReminders($date, $time),
                    'follow_up' => $service->sendFollowUpReminders($date, $time),
                ];
                Log::info('用药提醒定时任务执行完成', $result);
            } catch (\Throwable $exception) {
                Log::error('用药提醒定时任务执行异常', [
                    'message' => $exception->getMessage(),
                ]);
            }
        });
    }
}
