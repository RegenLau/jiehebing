<?php

namespace app\services\admin;

use app\exception\ServiceException;
use app\model\HealthArticleModel;

class HealthArticleService
{
    public function getList(int $current, int $size, string $keyword = '', string $status = ''): array
    {
        $query = HealthArticleModel::query()
            ->orderByDesc('sort')
            ->orderByDesc('id');

        if ($keyword !== '') {
            $query->where(function ($builder) use ($keyword) {
                $builder->where('title', 'like', '%' . $keyword . '%')
                    ->orWhere('summary', 'like', '%' . $keyword . '%');
            });
        }

        if ($status !== '') {
            $query->where('status', (int)$status);
        }

        $paginator = $query->paginate(
            $size,
            [
                'id',
                'title',
                'cover',
                'summary',
                'content',
                'view_count',
                'sort',
                'status',
                'published_at',
                'created_at',
                'updated_at',
            ],
            'current',
            $current
        );

        $list = collect($paginator->items())
            ->map(fn(HealthArticleModel $item) => $this->formatArticle($item, false))
            ->values()
            ->toArray();

        return [
            'list'    => $list,
            'total'   => $paginator->total(),
            'current' => $paginator->currentPage(),
            'size'    => $paginator->perPage(),
        ];
    }

    public function getDetail(int $id): array
    {
        $article = HealthArticleModel::query()->find($id);
        if (!$article) {
            throw new ServiceException('文章不存在', 404);
        }

        return $this->formatArticle($article, true);
    }

    public function save(array $data): array
    {
        $articleId = isset($data['id']) ? (int)$data['id'] : 0;
        $payload = $this->normalizePayload($data);

        if ($articleId > 0) {
            $article = HealthArticleModel::query()->find($articleId);
            if (!$article) {
                throw new ServiceException('文章不存在', 404);
            }
            $article->fill($payload);
            $article->save();
            return $this->formatArticle($article, true);
        }

        $article = HealthArticleModel::query()->create($payload);
        return $this->formatArticle($article, true);
    }

    public function toggleStatus(int $id, int $status): array
    {
        if (!in_array($status, [0, 1], true)) {
            throw new ServiceException('状态值不合法', 422);
        }

        $article = HealthArticleModel::query()->find($id);
        if (!$article) {
            throw new ServiceException('文章不存在', 404);
        }

        $article->status = $status;
        $article->save();

        return [
            'id'     => (int)$article->id,
            'status' => (int)$article->status,
        ];
    }

    private function normalizePayload(array $data): array
    {
        $title = trim((string)($data['title'] ?? ''));
        $summary = trim((string)($data['summary'] ?? ''));
        $content = trim((string)($data['content'] ?? ''));
        $cover = trim((string)($data['cover'] ?? ''));
        $sort = (int)($data['sort'] ?? 0);
        $status = (int)($data['status'] ?? 1);
        $publishedAt = trim((string)($data['published_at'] ?? $data['publishedAt'] ?? ''));

        if ($title === '') {
            throw new ServiceException('文章标题不能为空', 422);
        }
        if ($summary === '') {
            throw new ServiceException('文章摘要不能为空', 422);
        }
        if ($content === '') {
            throw new ServiceException('文章内容不能为空', 422);
        }
        if (!in_array($status, [0, 1], true)) {
            throw new ServiceException('状态值不合法', 422);
        }
        if ($sort < 0) {
            throw new ServiceException('排序值不能小于0', 422);
        }

        return [
            'title'        => $title,
            'cover'        => $cover,
            'summary'      => $summary,
            'content'      => $content,
            'sort'         => $sort,
            'status'       => $status,
            'published_at' => $publishedAt !== '' ? $publishedAt : date('Y-m-d H:i:s'),
        ];
    }

    private function formatArticle(HealthArticleModel $article, bool $withContent): array
    {
        $result = [
            'id'           => (int)$article->id,
            'title'        => (string)$article->title,
            'cover'        => (string)($article->cover ?? ''),
            'summary'      => (string)($article->summary ?? ''),
            'view_count'   => (int)($article->view_count ?? 0),
            'sort'         => (int)($article->sort ?? 0),
            'status'       => (int)($article->status ?? 0),
            'published_at' => $article->published_at ? (string)$article->published_at : '',
            'created_at'   => $article->created_at ? (string)$article->created_at : '',
            'updated_at'   => $article->updated_at ? (string)$article->updated_at : '',
        ];

        if ($withContent) {
            $result['content'] = (string)($article->content ?? '');
        }

        return $result;
    }
}
