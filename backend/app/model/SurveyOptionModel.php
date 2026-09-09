<?php

namespace app\model;

use support\Model;

/**
 * tb_survey_option 问卷选项表
 * @property integer $id
 * @property integer $question_id 所属题目ID
 * @property string $label 选项文案
 * @property integer $sort_order 排序
 * @property integer $is_exclusive 是否互斥选项
 * @property integer $trigger_input 选中后是否展开条件输入框
 * @property array $input_fields 条件输入框字段定义
 */
class SurveyOptionModel extends Model
{
    protected $connection = 'mysql';

    protected $table = 'tb_survey_option';

    protected $primaryKey = 'id';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = [
        'input_fields' => 'array',
    ];
}
