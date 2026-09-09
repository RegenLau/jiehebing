<?php

namespace app\controller;

use app\exception\ServiceException;
use app\services\FileService;
use app\services\wechat\WechatMiniService;
use support\Log;
use support\Request;
use DI\Attribute\Inject;
use support\Response;


class WechatController extends BaseController
{


    private WechatMiniService $wechatMiniService;

    public function __construct()
    {
        $this->wechatMiniService = new WechatMiniService();
    }

    /**
     * 小程序token 获取
     * @param Request $request
     * @return Response
     * @throws ServiceException
     * @throws \GuzzleHttp\Exception\GuzzleException
     */
    public function getAppToken(Request $request): Response
    {
        $refresh = false;
        $data    = $request->all();
        $appid   = $data['appid'] ?? getenv('WECHAT_MINI_APP_ID');
        if (!empty($data['refresh'])) {
            $refresh = true;
        }
        $tokenArr = $this->wechatMiniService->getToken($appid, $refresh);
        if ($tokenArr) {
            return json(['code' => 0, 'data' => $tokenArr, 'message' => 'success']);
        }
        return json(['code' => 1, 'data' => [], 'message' => 'token 获取失败']);
    }

}
