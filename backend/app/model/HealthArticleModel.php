<?php

namespace app\model;

use Illuminate\Database\Eloquent\SoftDeletes;
use support\Model;

/**
 * tb_health_article 健康科普文章表
 * @property integer $id
 * @property string $title 标题
 * @property string $cover 封面图
 * @property string $summary 摘要
 * @property string $content 正文内容
 * @property integer $view_count 浏览量
 * @property integer $sort 排序
 * @property integer $status 状态 1上架 0下架
 * @property string $published_at 发布时间
 * @property string $created_at 创建时间
 * @property string $updated_at 更新时间
 * @property string $deleted_at 删除时间
 */
class HealthArticleModel extends Model
{
    use SoftDeletes;

    protected function serializeDate(\DateTimeInterface $date): string
    {
        return $date->format('Y-m-d H:i:s');
    }

    protected $connection = 'mysql';

    protected $table = 'tb_health_article';

    protected $primaryKey = 'id';

    public $timestamps = true;

    protected $guarded = [];
}
