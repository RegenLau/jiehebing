<?php

namespace app\model;

use Illuminate\Database\Eloquent\SoftDeletes;
use support\Model;

/**
 * tb_user_medicine 用户药品表
 * @property integer $id (主键)
 * @property integer $user_id 用户id
 * @property string $name 药品名称
 * @property string $specification 规格
 * @property string $usage 服用方式
 * @property integer $frequency 用药频次
 * @property string $dosage 每次剂量
 * @property string $dosage_value 每次剂量数量
 * @property string $dosage_unit 每次剂量单位
 * @property string $remark 备注
 * @property string $trade_name 商品名
 * @property string $company 厂家
 * @property string $medicine_count 数量
 * @property string $ybm 药品医保码
 * @property string $thumb 药品图片
 * @property string $batch_no 批次号
 * @property integer $sort 排序
 * @property string $source 来源 manual/ocr
 * @property string $created_at 创建时间
 * @property string $updated_at 更新时间
 * @property string $deleted_at 删除时间
 */
class UserMedicineModel extends Model
{
    use SoftDeletes;

    protected function serializeDate(\DateTimeInterface $date): string
    {
        return $date->format('Y-m-d H:i:s');
    }

    protected $connection = 'mysql';

    protected $table = 'tb_user_medicine';

    protected $primaryKey = 'id';

    public $timestamps = true;

    protected $guarded = [];
}
