<?php

namespace app\model;

use Illuminate\Database\Eloquent\SoftDeletes;
use support\Model;

/**
 * tb_user_adverse_reaction_report 用户不良反应上报表
 * @property integer $id
 * @property integer $user_id 用户id
 * @property string $occurred_at 发生时间
 * @property string $symptoms 主要症状JSON
 * @property string $symptom_description 症状描述
 * @property integer $severity 严重程度 1轻度 2中度 3重度
 * @property string $severity_text 严重程度文案
 * @property string $advice_text 提示文案
 * @property integer $status 状态
 * @property string $created_at 创建时间
 * @property string $updated_at 更新时间
 * @property string $deleted_at 删除时间
 */
class UserAdverseReactionReportModel extends Model
{
    use SoftDeletes;

    protected function serializeDate(\DateTimeInterface $date): string
    {
        return $date->format('Y-m-d H:i:s');
    }

    protected $connection = 'mysql';

    protected $table = 'tb_user_adverse_reaction_report';

    protected $primaryKey = 'id';

    public $timestamps = true;

    protected $guarded = [];
}
