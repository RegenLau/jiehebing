<?php

namespace app\model;

use Illuminate\Database\Eloquent\SoftDeletes;
use support\Model;

/**
 * xiaozhi_admin 管理员信息表
 * @property integer $id 用户ID,主键
 * @property string $username 用户名
 * @property string $password 密码
 * @property string $phone 手机
 * @property string $email 用户邮箱
 * @property string $avatar 用户头像
 * @property integer $status 状态 0=禁用 1=启用
 * @property string $created_at 创建时间
 * @property string $updated_at 更新时间
 * @property string $deleted_at 删除时间
 */
class AdminModel extends Model
{
    use SoftDeletes;

    protected function serializeDate(\DateTimeInterface $date): string
    {
        return $date->format('Y-m-d H:i:s');
    }

    protected $connection = 'mysql';
    protected $table = 'tb_admin';
    protected $primaryKey = 'id';
    public $timestamps = true;

    protected $guarded = [];

    protected $hidden = ['password'];
}
