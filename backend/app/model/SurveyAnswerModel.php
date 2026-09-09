<?php

namespace app\model;

use support\Model;

/**
 * tb_survey_answer 问卷答案记录表
 * @property integer $id
 * @property integer $template_id 模板ID
 * @property integer $user_id 用户ID（即患者ID，对应 tb_user.id）
 * @property integer $question_id 题目ID
 * @property array $option_ids 选中的选项ID数组
 * @property string $text_value 文本类答案
 * @property array $extra_inputs 条件输入框填写内容
 * @property string $submitted_at 提交时间
 */
class SurveyAnswerModel extends Model
{
    protected $connection = 'mysql';

    protected $table = 'tb_survey_answer';

    protected $primaryKey = 'id';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = [
        'option_ids' => 'array',
        'extra_inputs' => 'array',
    ];
}
