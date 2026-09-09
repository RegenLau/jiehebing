<?php

namespace app\middleware;

use app\model\UserModel;
use Tinywan\Jwt\Exception\JwtTokenException;
use Tinywan\Jwt\Exception\JwtTokenExpiredException;
use Tinywan\Jwt\JwtToken;
use Webman\Http\Request;
use Webman\Http\Response;
use Webman\MiddlewareInterface;
use support\Log;

class ArchiveMiddleware implements MiddlewareInterface
{
    public function process(Request $request, callable $handler): Response
    {
        try {
            $jwtUser = JwtToken::getUser();
            if (!$jwtUser) {
                return json(['code' => 402, 'data' => [], 'message' => '您还没有登录']);
            }
            $isArchived = UserModel::query()->where('id', $jwtUser->id)->value('is_archived');
            if ((int)$isArchived !== 1) {
                return json(['code' => 407, 'data' => [], 'message' => '请先完成建档']);
            }
            return $handler($request);
        } catch (JwtTokenException|JwtTokenExpiredException $e) {
            Log::error('建档校验失败1', ['message' => $e->getMessage()]);
            return json(['code' => 402, 'data' => [], 'message' => '登录失败，请稍后再试']);
        } catch (\Throwable $e) {
            Log::error('建档校验失败2', ['message' => $e->getMessage()]);
            return json(['code' => 406, 'data' => [], 'message' => '建档校验失败，请稍后再试']);
        }
    }
}
