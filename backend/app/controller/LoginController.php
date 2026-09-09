<?php

namespace app\controller;

use app\exception\ServiceException;
use app\model\UserModel;
use app\services\wechat\WechatMiniService;
use GuzzleHttp\Exception\GuzzleException;
use support\Log;
use support\Request;
use DI\Attribute\Inject;
use support\Response;
use Tinywan\Jwt\JwtToken;
use yzh52521\WebmanLock\Locker;

class LoginController extends BaseController
{

    private WechatMiniService $wechatMiniService;

    public function __construct()
    {
        $this->wechatMiniService = new WechatMiniService();
    }


    public function index(Request $request): Response
    {
        return json(['code' => 0, 'data' => [], 'message' => 'this is digital insert']);
    }

    /**
     * 、
     * @param Request $request
     * @return Response
     * @throws ServiceException
     * @throws GuzzleException
     */
    public function login(Request $request): Response
    {
        $code = $request->input('code');
        if (!$code) {
            return json(['code' => 1, 'data' => [], 'message' => '参数错误']);
        }
        $info = $this->wechatMiniService->auth($code);
        if (!isset($info['openid'])) {
            return json(['code' => 1, 'data' => [], 'message' => '微信登录失败']);
        }
        $unionid = $info['unionid'] ?? '';
        $user    = $this->saveUserInfo($info);
        $token   = [
            'user'  => ['id' => $user['id'], 'openid' => $user['openid'], 'unionid' => $unionid],
            'token' => $this->generateToken($user['id'], $info['openid'], $unionid)
        ];
        return json(['code' => 0, 'data' => $token, 'message' => '登录成功']);
    }


    /**
     * @param Request $request
     * @return Response
     * @throws ServiceException
     * @throws GuzzleException
     */
    public function getUserMobile(Request $request): Response
    {
        $code = $request->input('code');
        if (!$code) {
            return json(['code' => 1, 'data' => [], 'message' => '参数错误']);
        }
        $res = $this->wechatMiniService->getuserphonenumber($code);
        if ($res && isset($res['errcode']) && (int)$res['errcode'] === 0) {
            if (empty($res['phone_info']['purePhoneNumber'])) {
                $this->wechatMiniService->getToken(true);
                throw new ServiceException('小程序手机号获取失败');
            }
            $mobile = $res['phone_info']['purePhoneNumber'];
            UserModel::query()->where('id', $this->id())->update(['mobile' => $mobile]);
            return json(['code' => 0, 'data' => ['mobile' => $mobile], 'message' => '获取成功']);
        } else {
            $this->wechatMiniService->getToken(true);
        }
        return json(['code' => 1, 'data' => [], 'message' => '手机号获取失败']);
    }


    /**
     * 本地登录
     * @param Request $request
     * @return Response
     */
    public function loginTest(Request $request): Response
    {
        $openid = $request->input('openid');
        if (!$openid) {
            return json(['code' => 1, 'data' => [], 'message' => 'openid不能为空']);
        }
        $user = UserModel::query()->where('openid', $openid)->first();
        if (!$user) {
            return json(['code' => 1, 'data' => [], 'message' => '用户信息不存在']);
        }
        $user         = $user->toArray();
        $token = [
            'user'  => ['id' => $user['id'], 'openid' => $user['openid'], 'unionid' => $user['unionid']],
            'token' => $this->generateToken($user['id'], $user['openid'], $user['unionid'])
        ];
        return json(['code' => 0, 'data' => $token, 'message' => '登录成功']);
    }


    /**
     * @param array $info
     * @return array
     * @throws ServiceException
     */
    private function saveUserInfo(array $info): array
    {
        $lock = Locker::lock($info['openid']);
        if (!$lock->acquire()) {
            throw new ServiceException('操作太频繁，请稍后再试');
        }
        try {
            $user = UserModel::query()->where('openid', $info['openid'])->first();
            if ($user) {
                $user->unionid = $info['unionid'] ?? '';
                $user->save();
                return $user->toArray();
            }
            $user          = new UserModel();
            $user->openid  = $info['openid'];
            $user->unionid = $info['unionid'] ?? '';
            $user->save();
            return $user->toArray();
        } finally {
            $lock->release();
        }
    }


    /**
     * token 生成
     * @param int $userId
     * @param string $openid
     * @param string $unionid
     * @return array
     */
    private function generateToken(int $userId, string $openid, string $unionid): array
    {
        $user = [
            'id'            => $userId,
            'openid'        => $openid,
            'unionid'       => $unionid,
            'client'        => 'WECHAT'
        ];
        return JwtToken::generateToken($user);
    }


}