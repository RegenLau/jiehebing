<?php

namespace app\model;

use support\Model;

/**
 * tb_survey_question 问卷题目表
 * @property integer $id
 * @property integer $template_id 所属模板ID
 * @property integer $question_no 题号
 * @property string $title 题干
 * @property string $type 题型: RADIO=单选 CHECKBOX=多选 TEXT=文本
 * @property integer $required 是否必填
 * @property integer $sort_order 展示顺序
 * @property string $placeholder 输入框占位提示
 */
class SurveyQuestionModel extends Model
{
    protected $connection = 'mysql';

    protected $table = 'tb_survey_question';

    protected $primaryKey = 'id';

    public $timestamps = false;

    protected $guarded = [];
}
