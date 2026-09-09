<?php

namespace app\services\wechat;

use support\Db;
use support\Log;
use support\Redis;
use yzh52521\WebmanLock\Locker;

class MedicationReminderService
{
    private const TEMPLATE_ID = 'EV1-aZpYcznBnX1DX2iY9OjDMZbe7AKcUJFW5viD7cU';
    private const SENT_CACHE_TTL = 172800;
    private const DEFAULT_PROMPT = '请记得每天按时服药,注意饮食';
    private const DEFAULT_FOLLOW_UP_PROMPT = '您有用药提醒尚未打卡，请尽快完成';
    private const LOCK_TTL = 30;

    private WechatMiniService $wechatMiniService;

    public function __construct()
    {
        $this->wechatMiniService = new WechatMiniService();
    }

    public function sendDueReminders(?string $date = null, ?string $time = null, int $window = 1): array
    {
        $date   = $date ?: date('Y-m-d');
        $time   = $time ?: date('H:i');
        $window = max(1, $window);

        $groups = $this->getDueReminderGroups($date, $time, $window);
        return $this->sendReminderGroups($groups, $date, $time, $window, 'initial');
    }

    public function sendFollowUpReminders(?string $date = null, ?string $time = null, int $window = 1, int $delayMinutes = 60): array
    {
        $date         = $date ?: date('Y-m-d');
        $time         = $time ?: date('H:i');
        $window       = max(1, $window);
        $delayMinutes = max(1, $delayMinutes);

        $groups = $this->getFollowUpReminderGroups($date, $time, $window, $delayMinutes);
        return $this->sendReminderGroups($groups, $date, $time, $window, 'follow_up');
    }

    public function getDueReminderGroups(string $date, string $time, int $window = 1): array
    {
        $timeSlots = $this->buildTimeSlots($time, $window);
        if (empty($timeSlots)) {
            return [];
        }

        return $this->queryReminderGroups($date, $timeSlots);
    }

    public function getFollowUpReminderGroups(string $date, string $time, int $window = 1, int $delayMinutes = 60): array
    {
        $timeSlots = $this->buildOffsetTimeSlots($time, $window, -$delayMinutes);
        if (empty($timeSlots)) {
            return [];
        }

        return $this->queryReminderGroups($date, $timeSlots);
    }

    private function queryReminderGroups(string $date, array $timeSlots): array
    {
        if (empty($timeSlots)) {
            return [];
        }

        $rows = Db::table('tb_user_medication_plan as plan')
            ->join('tb_user as user', 'user.id', '=', 'plan.user_id')
            ->where('plan.plan_date', $date)
            ->where('plan.status', 0)
            ->whereIn('plan.plan_time', $timeSlots)
            ->whereNotNull('user.openid')
            ->where('user.openid', '<>', '')
            ->orderBy('plan.user_id')
            ->orderBy('plan.plan_time')
            ->orderBy('plan.id')
            ->get([
                'plan.id',
                'plan.user_id',
                'plan.plan_date',
                'plan.plan_time',
                'plan.name',
                'plan.usage',
                'plan.frequency',
                'plan.dosage',
                'plan.dosage_value',
                'plan.dosage_unit',
                'user.openid',
            ]);

        if ($rows->isEmpty()) {
            return [];
        }

        $groups = [];
        foreach ($rows as $row) {
            $groupKey = $row->user_id . '|' . $row->plan_date . '|' . $row->plan_time;
            if (!isset($groups[$groupKey])) {
                $groups[$groupKey] = [
                    'user_id'        => (int)$row->user_id,
                    'openid'         => (string)$row->openid,
                    'plan_date'      => (string)$row->plan_date,
                    'plan_time'      => (string)$row->plan_time,
                    'plan_ids'       => [],
                    'medicine_names' => [],
                    'usage_texts'    => [],
                ];
            }

            $groups[$groupKey]['plan_ids'][]       = (int)$row->id;
            $groups[$groupKey]['medicine_names'][] = trim((string)$row->name);
            $usageText                             = $this->buildUsageText(
                (string)($row->usage ?? ''),
                (int)($row->frequency ?? 0),
                (string)($row->dosage ?? ''),
                (string)($row->dosage_value ?? ''),
                (string)($row->dosage_unit ?? '')
            );
            if ($usageText !== '') {
                $groups[$groupKey]['usage_texts'][] = $usageText;
            }
        }

        foreach ($groups as &$group) {
            $group['medicine_names'] = array_values(array_unique(array_filter($group['medicine_names'])));
            $group['usage_texts']    = array_values(array_unique(array_filter($group['usage_texts'])));
        }
        unset($group);

        return array_values($groups);
    }

    private function sendReminderGroups(array $groups, string $date, string $time, int $window, string $stage): array
    {
        $result = [
            'date'    => $date,
            'time'    => $time,
            'window'  => $window,
            'stage'   => $stage,
            'total'   => count($groups),
            'sent'    => 0,
            'skipped' => 0,
            'failed'  => 0,
        ];

        foreach ($groups as $group) {
            $cacheKey = $this->buildSentCacheKey((int)$group['user_id'], (string)$group['plan_date'], (string)$group['plan_time'], $stage);
            $lock     = Locker::lock($this->buildSendLockKey($group, $stage), (int)config('patient.medication_reminder_lock_ttl', self::LOCK_TTL));
            if (!$lock->acquire()) {
                $result['skipped']++;
                continue;
            }

            try {
                if (Redis::get($cacheKey)) {
                    $result['skipped']++;
                    continue;
                }

                if ($stage === 'follow_up' && !$this->wasInitialReminderSent($group)) {
                    $result['skipped']++;
                    continue;
                }

                // The group was queried before acquiring the lock; recheck the
                // plans immediately before sending to avoid a stale follow-up.
                if (!$this->hasPendingPlans($group)) {
                    $result['skipped']++;
                    continue;
                }

                $success = $this->wechatMiniService->sendSubscribeMessage(
                    self::TEMPLATE_ID,
                    (string)$group['openid'],
                    $this->buildTemplateData($group, $stage),
                    (string)config('patient.medication_reminder_page', 'pages/followup/index'),
                );

                if ($success) {
                    Redis::set($cacheKey, '1', 'EX', $this->getSentCacheTtl());
                    $result['sent']++;
                } else {
                    $result['failed']++;
                }
            } catch (\Throwable $exception) {
                $result['failed']++;
                Log::error('用药提醒订阅消息发送失败', [
                    'stage'     => $stage,
                    'user_id'   => $group['user_id'],
                    'plan_date' => $group['plan_date'],
                    'plan_time' => $group['plan_time'],
                    'plan_ids'  => $group['plan_ids'],
                    'message'   => $exception->getMessage(),
                ]);
            } finally {
                $lock->release();
            }
        }

        return $result;
    }

    private function buildTemplateData(array $group, string $stage = 'initial'): array
    {
        $medicineNames = $this->shortenThingValue(implode('、', $group['medicine_names']));
        $usageText     = $this->resolveUsageSummary($group['usage_texts']);
        $promptConfigKey = $stage === 'follow_up'
            ? 'patient.medication_reminder_follow_up_prompt'
            : 'patient.medication_reminder_prompt';
        $defaultPrompt = $stage === 'follow_up'
            ? self::DEFAULT_FOLLOW_UP_PROMPT
            : self::DEFAULT_PROMPT;
        $prompt = $this->shortenThingValue((string)config($promptConfigKey, $defaultPrompt));
        return [
            'thing3' => ['value' => $medicineNames !== '' ? $medicineNames : '请按时服药'],
            'time4'  => ['value' => (string)$group['plan_time']],
            'thing6' => ['value' => $usageText !== '' ? $usageText : '请按医嘱服药'],
            'thing5' => ['value' => $prompt],
        ];
    }

    private function resolveUsageSummary(array $usageTexts): string
    {
        if (empty($usageTexts)) {
            return '请按医嘱服药';
        }
        if (count($usageTexts) === 1) {
            return $this->shortenThingValue($usageTexts[0]);
        }
        return $this->shortenThingValue('请按各药品医嘱按时服用');
    }

    private function buildUsageText(string $usage, int $frequency, string $dosage, string $dosageValue, string $dosageUnit): string
    {
        $parts = [];
        $usage = trim($usage);
        if ($usage !== '') {
            $parts[] = $usage;
        }

        if ($frequency > 0) {
            $parts[] = '每日' . $frequency . '次';
        }

        $dosage = trim($dosage);
        if ($dosage === '') {
            $dosage = trim($dosageValue . $dosageUnit);
        }
        if ($dosage !== '') {
            $parts[] = str_starts_with($dosage, '每次') ? $dosage : '每次' . $dosage;
        }

        return implode('，', $parts);
    }

    private function shortenThingValue(string $value, int $limit = 20): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }
        if (mb_strlen($value) <= $limit) {
            return $value;
        }

        return mb_substr($value, 0, max(0, $limit - 1)) . '…';
    }

    private function buildTimeSlots(string $time, int $window): array
    {
        if (!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $time)) {
            return [];
        }

        $base = \DateTimeImmutable::createFromFormat('Y-m-d H:i', '2000-01-01 ' . $time);
        if (!$base) {
            return [];
        }

        $times = [];
        for ($i = 0; $i < $window; $i++) {
            $times[] = $base->modify('+' . $i . ' minute')->format('H:i');
        }
        return array_values(array_unique($times));
    }

    private function wasInitialReminderSent(array $group): bool
    {
        $initialCacheKey = $this->buildSentCacheKey(
            (int)$group['user_id'],
            (string)$group['plan_date'],
            (string)$group['plan_time'],
            'initial'
        );

        return (bool)Redis::get($initialCacheKey);
    }

    private function hasPendingPlans(array $group): bool
    {
        return Db::table('tb_user_medication_plan')
            ->where('user_id', (int)$group['user_id'])
            ->where('plan_date', (string)$group['plan_date'])
            ->where('plan_time', (string)$group['plan_time'])
            ->where('status', 0)
            ->whereIn('id', $group['plan_ids'])
            ->exists();
    }

    private function getSentCacheTtl(): int
    {
        return max(3600, (int)config('patient.medication_reminder_sent_ttl', self::SENT_CACHE_TTL));
    }

    private function buildOffsetTimeSlots(string $time, int $window, int $offsetMinutes): array
    {
        if (!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $time)) {
            return [];
        }

        $base = \DateTimeImmutable::createFromFormat('Y-m-d H:i', '2000-01-01 ' . $time);
        if (!$base) {
            return [];
        }

        $times = [];
        for ($i = 0; $i < $window; $i++) {
            $times[] = $base
                ->modify('+' . $i . ' minute')
                ->modify(($offsetMinutes >= 0 ? '+' : '') . $offsetMinutes . ' minute')
                ->format('H:i');
        }
        return array_values(array_unique($times));
    }

    private function buildSentCacheKey(int $userId, string $date, string $time, string $stage = 'initial'): string
    {
        return sprintf('medication_reminder_sent:%s:%d:%s:%s', $stage, $userId, $date, $time);
    }

    private function buildSendLockKey(array $group, string $stage = 'initial'): string
    {
        return sprintf(
            'medication_reminder_lock:%s:%d:%s:%s',
            $stage,
            (int)$group['user_id'],
            (string)$group['plan_date'],
            (string)$group['plan_time']
        );
    }
}
