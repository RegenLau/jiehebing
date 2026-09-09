<?php

namespace app\controller\admin;

use app\controller\admin\AdminBaseController;
use app\exception\ServiceException;
use app\services\admin\LoginService;
use Respect\Validation\Exceptions\ValidationException;
use Respect\Validation\Validator as v;
use support\Request;

class LoginController extends AdminBaseController
{
    private LoginService $service;

    public function __construct()
    {
        $this->service = new LoginService();
    }

    /**
     * GET /core/captcha
     */
    public function captcha(Request $request): \support\Response
    {
        return $this->ok($this->service->captcha());
    }

    /**
     * POST /core/login
     * Body: { username, password, captcha, uuid }
     */
    public function login(Request $request): \support\Response
    {
        $body     = $request->post();
        $username = trim($body['username'] ?? '');
        $password = trim($body['password'] ?? '');
        $captcha  = trim($body['code'] ?? '');
        $uuid     = trim($body['uuid'] ?? '');

        try {
            v::notEmpty()->stringType()->setName('用户名')->check($username);
            v::notEmpty()->stringType()->setName('密码')->check($password);
        } catch (ValidationException $e) {
            return $this->fail($e->getMessage(), 422);
        }
        try {
            return $this->ok($this->service->login($username, $password, $captcha, $uuid));
        } catch (ServiceException $e) {
            return $this->fail($e->getMessage(), $e->getCode());
        }
    }

    /**
     * GET /core/system/user
     */
    public function userInfo(Request $request): \support\Response
    {
        return $this->ok($this->service->userInfo((array)($request->admin ?? [])));
    }
}
