<?php

namespace app\middleware;

use app\model\UserModel;
use Tinywan\Jwt\Exception\JwtTokenException;
use Tinywan\Jwt\Exception\JwtTokenExpiredException;
use Tinywan\Jwt\JwtToken;
use Webman\MiddlewareInterface;
use Webman\Http\Response;
use Webman\Http\Request;
use support\Log;

class LoginMiddleware implements MiddlewareInterface
{

    public function process(Request $request, callable $handler): Response
    {
        try {
            $authorization = $request->header('Authorization');
            if (!$authorization) {
                return json(['code' => 1, 'data' => [], 'message' => '请先登录']);
            }
            $jwtUser = JwtToken::getUser();
            if (!$jwtUser) {
                return json(['code' => 402, 'data' => [], 'message' => '您还没有登录']);
            }
            $userStatus = UserModel::query()->where('id', $jwtUser->id)->value('status');
            if ($userStatus == 0) {
                return json(['code' => 402, 'data' => [], 'message' => '暂无权限访问，请联系管理员']);
            }
            return $handler($request);
        } catch (JwtTokenException|JwtTokenExpiredException|JwtTokenException $e) {
            Log::error('登录失败1', ['message' => $e->getMessage()]);
            return json(['code' => 402, 'data' => [], 'message' => '登录失败，请稍后再试']);
        } catch (\Throwable $e) {
            Log::error('登录失败2', ['message' => $e->getMessage()]);
            return json(['code' => 402, 'data' => [], 'message' => '登录失败，请稍后再试']);
        }
    }
}