<?php

namespace app\controller;

use app\model\HealthArticleModel;
use Respect\Validation\Exceptions\ValidationException;
use Respect\Validation\Validator as v;
use support\Request;
use support\Response;

class HealthArticleController extends BaseController
{
    public function articleList(Request $request): Response
    {
        try {
            $params = v::input($request->get(), [
                'page'      => v::oneOf(v::nullType(), v::intVal()->min(1))->setName('页码'),
                'page_size' => v::oneOf(v::nullType(), v::intVal()->between(1, 100))->setName('每页数量'),
            ]);
        } catch (ValidationException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }
        $page      = isset($params['page']) ? (int)$params['page'] : 1;
        $pageSize  = isset($params['page_size']) ? (int)$params['page_size'] : 10;
        $paginator = HealthArticleModel::query()
            ->where('status', 1)
            ->orderByDesc('sort')
            ->orderByDesc('id')
            ->paginate($pageSize, [
                'id',
                'title',
                'cover',
                'summary',
                'view_count',
                'sort',
                'published_at',
            ], 'page', $page);
        $list      = collect($paginator->items())->map(fn($item) => [
            'id'           => (int)$item->id,
            'title'        => (string)$item->title,
            'cover'        => (string)$item->cover,
            'summary'      => (string)$item->summary,
            'view_count'   => (int)$item->view_count,
            'sort'         => (int)$item->sort,
            'published_at' => $item->published_at ? (string)$item->published_at : '',
        ])->toArray();
        return json([
            'code'    => 0,
            'data'    => [
                'list'         => $list,
                'total'        => $paginator->total(),
                'per_page'     => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
            ],
            'message' => '获取成功'
        ]);
    }

    public function articleDetail(Request $request): Response
    {
        try {
            $data = v::input($request->get(), [
                'id' => v::digit()->setName('文章ID'),
            ]);
        } catch (ValidationException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }
        $article = HealthArticleModel::query()->where('id', (int)$data['id'])->where('status', 1)->first();
        if (!$article) {
            return json(['code' => 1, 'data' => [], 'message' => '文章不存在']);
        }
        $article->increment('view_count');
        $article->refresh();
        return json([
            'code'    => 0,
            'data'    => [
                'id'           => $article->id,
                'title'        => $article->title,
                'cover'        => $article->cover,
                'summary'      => $article->summary,
                'content'      => $article->content,
                'view_count'   => $article->view_count,
                'sort'         => $article->sort,
                'published_at' => $article->published_at ? $article->published_at : '',
                'created_at'   => $article->created_at ? $article->created_at : '',
            ],
            'message' => '获取成功'
        ]);
    }
}
