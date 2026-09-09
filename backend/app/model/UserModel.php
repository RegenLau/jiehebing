<?php

namespace app\model;

use Illuminate\Database\Eloquent\SoftDeletes;
use support\Model;

/**
 * tb_user 用户表
 * @property integer $id (主键)
 * @property string $openid 微信openid
 * @property integer $hospital_id 医院id
 * @property string $hospital_name 就诊医院名称
 * @property string $department_name 就诊科室名称
 * @property integer $visit_type 就诊类型 1门诊 2住院
 * @property string $nickname 用户昵称
 * @property string $name 患者姓名
 * @property string $unionid 微信unionid
 * @property string $mobile 手机号
 * @property string $avatar 头像
 * @property string $birth 出生日期
 * @property integer $gender 性别
 * @property integer $age 年龄
 * @property integer $is_archived 是否已建档 0否 1是
 * @property string $enroll_date 建档日期
 * @property string $reminder_setting 提醒设置
 * @property integer $status 状态
 * @property string $created_at 创建时间
 * @property string $updated_at 更新时间
 * @property string $deleted_at 删除时间
 */
class UserModel extends Model
{

    use SoftDeletes;


    protected function serializeDate(\DateTimeInterface $date): string
    {
        return $date->format('Y-m-d H:i:s');
    }

    /**
     * The connection name for the model.
     *
     * @var string|null
     */
    protected $connection = 'mysql';
    
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'tb_user';

    /**
     * The primary key associated with the table.
     *
     * @var string
     */
    protected $primaryKey = 'id';

    /**
     * Indicates if the model should be timestamped.
     *
     * @var bool
     */
    public $timestamps = true;


    protected $guarded = [];
    
}
