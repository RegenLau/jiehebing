<?php

namespace app\model;

use support\Model;

/**
 * tb_survey_template 随访问卷模板表
 * @property integer $id
 * @property string $code 模板编码
 * @property string $name 模板名称
 * @property string $description 问卷说明
 * @property integer $fillable_day 患者第几天可填写（相对建档日期）
 * @property integer $status 1=启用 0=停用
 * @property string $created_at 创建时间
 * @property string $updated_at 更新时间
 */
class SurveyTemplateModel extends Model
{
    protected function serializeDate(\DateTimeInterface $date): string
    {
        return $date->format('Y-m-d H:i:s');
    }

    protected $connection = 'mysql';

    protected $table = 'tb_survey_template';

    protected $primaryKey = 'id';

    public $timestamps = true;

    protected $guarded = [];
}
