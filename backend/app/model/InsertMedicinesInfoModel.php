<?php

namespace app\model;

use Illuminate\Database\Eloquent\SoftDeletes;
use support\Model;

/**
 * tb_insert_medicines_info 药品信息表
 * @property integer $id (主键)
 * @property integer $medicine_instruction_id 说明书ID
 * @property string $commonName 通用名
 * @property string $tradeName 商品名
 * @property string $company 厂家
 * @property string $licenseId 批准文号
 * @property string $ybm 医保码
 * @property string $specification 规格
 * @property string $bwm 本位码
 * @property string $txm 条形码
 * @property string $thumb 药品图片
 * @property integer $status 状态
 * @property integer $sort 排序
 * @property integer $indication_type 适应症类型
 * @property string $created_at 创建时间
 * @property string $updated_at 更新时间
 * @property string $deleted_at 删除时间
 */
class InsertMedicinesInfoModel extends Model
{
    use SoftDeletes;

    protected function serializeDate(\DateTimeInterface $date): string
    {
        return $date->format('Y-m-d H:i:s');
    }

    protected $connection = 'mysql';

    protected $table = 'tb_insert_medicines_info';

    protected $primaryKey = 'id';

    public $timestamps = true;

    protected $guarded = [];
}
