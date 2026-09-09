<?php

namespace app\model;

use Illuminate\Database\Eloquent\SoftDeletes;
use support\Model;

/**
 * tb_user_medication_plan 用户用药计划表
 * @property integer $id
 * @property integer $user_id 用户id
 * @property integer $medicine_id 药品id
 * @property string $plan_date 计划日期
 * @property integer $day_number 第几天
 * @property string $name 药品名称
 * @property string $specification 规格
 * @property string $usage 服用方式
 * @property integer $frequency 用药频次
 * @property string $dosage 每次剂量
 * @property string $dosage_value 每次剂量数量
 * @property string $dosage_unit 每次剂量单位
 * @property string $plan_time 提醒时间
 * @property integer $plan_index 当天第几次
 * @property integer $status 状态 0待打卡 1已打卡
 * @property string $checked_at 打卡时间
 * @property string $created_at 创建时间
 * @property string $updated_at 更新时间
 * @property string $deleted_at 删除时间
 */
class UserMedicationPlanModel extends Model
{
    use SoftDeletes;

    protected function serializeDate(\DateTimeInterface $date): string
    {
        return $date->format('Y-m-d H:i:s');
    }

    protected $connection = 'mysql';

    protected $table = 'tb_user_medication_plan';

    protected $primaryKey = 'id';

    public $timestamps = true;

    protected $guarded = [];
}
