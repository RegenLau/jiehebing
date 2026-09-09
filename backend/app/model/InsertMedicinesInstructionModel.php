<?php

namespace app\model;

use Illuminate\Database\Eloquent\SoftDeletes;
use support\Model;

/**
 * tb_insert_medicines_instruction 药品说明书表
 * @property integer $id (主键)
 * @property string $commonName 通用名
 * @property string $drugName 药品名称(HTML)
 * @property string $licenseId 批准文号
 * @property string $dosage 用法用量
 * @property string $characters 性状
 * @property string $contraindication 禁忌症
 * @property string $adverseReaction 不良反应
 * @property string $precaution 注意事项
 * @property string $ingredients 成分
 * @property string $indication 适应症
 * @property string $interaction 药物相互作用
 * @property string $storage 贮藏
 * @property string $warnings 警告
 * @property string $created_at 创建时间
 * @property string $updated_at 更新时间
 * @property string $deleted_at 删除时间
 */
class InsertMedicinesInstructionModel extends Model
{
    use SoftDeletes;

    protected function serializeDate(\DateTimeInterface $date): string
    {
        return $date->format('Y-m-d H:i:s');
    }

    protected $connection = 'mysql';

    protected $table = 'tb_insert_medicines_instruction';

    protected $primaryKey = 'id';

    public $timestamps = true;

    protected $guarded = [];
}
