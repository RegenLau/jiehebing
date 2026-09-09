<?php

namespace app\services\admin;

use app\exception\ServiceException;
use app\model\AdminModel;
use support\Redis;
use Webman\Captcha\CaptchaBuilder;
use Webman\Captcha\PhraseBuilder;

class LoginService
{
    /**
     * 生成图形验证码，答案存入 Redis（5 分钟有效）
     */
    public function captcha(): array
    {
        $builder = (new CaptchaBuilder(null, new PhraseBuilder(4, '0123456789')))->build();
        $uuid    = bin2hex(random_bytes(16));
        Redis::setex('captcha:' . $uuid, 300, $builder->getPhrase());
        return [
            'result' => 1,
            'uuid'   => $uuid,
            'image'  => $builder->inline(),
        ];
    }

    /**
     * 管理员登录，返回 token 信息
     *
     * @throws ServiceException
     */
    public function login(string $username, string $password, string $captcha, string $uuid): array
    {
        // 验证码校验（uuid 存在时才校验）
        if (!empty($uuid)) {
            $storedCode = Redis::get('captcha:' . $uuid);
            if (!$storedCode || strtolower($storedCode) !== strtolower($captcha)) {
                throw new ServiceException('验证码错误或已过期', 422);
            }
            Redis::del('captcha:' . $uuid);
        }

        /** @var AdminModel|null $admin */
        $admin = AdminModel::where('username', $username)->where('status', 1)->first();
        if (!$admin || !password_verify($password, $admin->password)) {
            throw new ServiceException('用户名或密码错误', 401);
        }
        $expiresIn   = 8 * 3600;
        $accessToken = bin2hex(random_bytes(32));
        Redis::setex('admin_token:' . $accessToken, $expiresIn, json_encode([
            'id'       => $admin->id,
            'username' => $admin->username,
            'phone'    => $admin->phone,
            'email'    => $admin->email,
            'avatar'   => $admin->avatar,
        ]));

        return [
            'token_type'    => 'Bearer',
            'expires_in'    => $expiresIn,
            'access_token'  => $accessToken,
            'refresh_token' => '',
        ];
    }

    /**
     * 格式化当前登录管理员信息
     */
    public function userInfo(array $admin): array
    {
        return [
            'id'         => $admin['id'] ?? 0,
            'username'   => $admin['username'] ?? '',
            'realname'   => $admin['username'] ?? '',
            'email'      => $admin['email'] ?? '',
            'phone'      => $admin['phone'] ?? '',
            'avatar'     => $admin['avatar'] ?? '',
            'roles'      => ['R_ADMIN'],
            'buttons'    => ['*'],
            'dashboard'  => '/dashboard/console',
            'department' => ['id' => 1, 'name' => 'Admin Team'],
        ];
    }
}
