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

class LoginMobileMiddleware implements MiddlewareInterface
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
            $user = UserModel::query()->where('id', $jwtUser->id)->first();
            if (!$user || !$user->mobile) {
                return json(['code' => 405, 'data' => [], 'message' => '请先绑定手机号']);
            }
            return $handler($request);
        } catch (JwtTokenException|JwtTokenExpiredException|JwtTokenException $e) {
            return json(['code' => 402, 'data' => [], 'message' => '登录失败，请稍后再试']);
        }
    }
}