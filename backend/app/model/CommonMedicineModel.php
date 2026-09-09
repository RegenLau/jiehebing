<?php

namespace app\model;

use support\Model;

/**
 * tb_common_medicine 常用药清单
 * @property integer $id (主键)
 * @property string $common_name 品种名
 * @property string $company 生产厂家
 * @property string $specification 规格
 * @property string $ybm 医保码
 * @property string $usage 服用方式
 * @property integer $frequency 用药频次
 * @property string $dosage 每次剂量
 * @property string $dosage_value 每次剂量数量
 * @property string $dosage_unit 每次剂量单位
 * @property string $medication_guidance 用药指导
 * @property string $thumb 药品图片
 * @property integer $sort_order 排序
 * @property integer $status 1=启用 0=停用
 * @property string $created_at 创建时间
 * @property string $updated_at 更新时间
 */
class CommonMedicineModel extends Model
{
    protected function serializeDate(\DateTimeInterface $date): string
    {
        return $date->format('Y-m-d H:i:s');
    }

    protected $connection = 'mysql';

    protected $table = 'tb_common_medicine';

    protected $primaryKey = 'id';

    public $timestamps = true;

    protected $guarded = [];
}
