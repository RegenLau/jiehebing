<?php

namespace app\middleware;

use Webman\Http\Request;
use Webman\Http\Response;
use Webman\MiddlewareInterface;
use support\Redis;

class AdminAuthMiddleware implements MiddlewareInterface
{
    public function process(Request $request, callable $handler): Response
    {
        $authorization = $request->header('Authorization', '');
        if (!preg_match('/Bearer\s+(.+)/i', $authorization, $matches)) {
            return json(['code' => 401, 'message' => '请先登录', 'data' => null]);
        }

        $token = trim($matches[1]);
        $admin = Redis::get('admin_token:' . $token);
        if (!$admin) {
            return json(['code' => 401, 'message' => '登录已过期，请重新登录', 'data' => null]);
        }

        $adminData = json_decode($admin, true);
        if (!is_array($adminData) || empty($adminData['id'])) {
            return json(['code' => 401, 'message' => '登录状态无效，请重新登录', 'data' => null]);
        }

        $request->admin = $adminData;

        return $handler($request);
    }
}
