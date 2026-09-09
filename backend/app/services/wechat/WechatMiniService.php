<?php

namespace app\services\wechat;

use app\exception\ServiceException;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

use support\Log;
use support\Redis;
use yzh52521\WebmanLock\Locker;

class WechatMiniService
{
    private const TOKEN_EXPIRE_TIME = 6900;
    private const TOKEN_LOCK_TTL = 15;
    private const TOKEN_REFRESH_GRACE_SECONDS = 30;
    private const TOKEN_WAIT_RETRY_TIMES = 10;
    private const TOKEN_WAIT_INTERVAL_MICROSECONDS = 200000;


    /** @var Client $client */
    public $client;


    public $accessToken;

    public function __construct()
    {
        $this->client = new Client([
            'timeout' => 10, // 5秒超时
        ]);
    }


    /**
     * 订阅消息发送
     * @param string $templateId
     * @param string $openid
     * @param array $data
     * @param string $page
     * @return bool
     * @throws ServiceException
     */
    public function sendSubscribeMessage(string $templateId, string $openid, array $data = [], string $page = ''): bool
    {
        $token = $this->getProductAccessToken()->accessToken;
        $url   = 'https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=' . $token;
        try {
            $response = $this->client->request('POST', $url, [
                "headers" => [
                    'Content-Type' => 'application/json; charset=UTF-8',
                ],
                'json'    => [
                    'template_id'       => $templateId,
                    'page'              => $page,
                    'touser'            => $openid,
                    'data'              => $data,
                    'miniprogram_state' => (getenv('APP_ENV') === 'local' || getenv('APP_ENV') === 'develop') ? 'trial' : 'formal',
                    'lang'              => 'zh_CN'
                ]
            ]);
            $resStr   = (string)$response->getBody();
            $info     = json_decode($resStr, true);
            Log::info('小程序订阅消息发送结果', ['data' => $data, 'info' => $info]);
            if ($info && (int)$info['errcode'] === 0) {
                return true;
            }
            throw  new ServiceException($info['errmsg']);
        } catch (GuzzleException $s) {
            Log::error("小程序订阅消息发送 :{$s->getFile()}[{$s->getLine()}]:" . $s->getMessage());
            return false;
        } catch (ServiceException $s) {
            throw  new ServiceException($s->getMessage());
        }
    }


    /**
     * 获取手机号
     * @param string $code
     * @return array|mixed
     * @throws ServiceException
     */
    public function getuserphonenumber(string $code)
    {
        $token = $this->getProductAccessToken()->accessToken;
        $url   = 'https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=' . $token;
        Log::info('小程序手机号请求URL', ['URL' => $url]);
        try {
            $response = $this->client->request('POST', $url, [
                "headers" => [
                    'Content-Type' => 'application/json; charset=UTF-8',
                ],
                'json'    => [
                    'code' => $code,
                ]
            ]);
            $info     = $response->getBody();
            $res      = json_decode($info, true);
            Log::info('小程序手机号请求结果', ['info' => $res]);
            return $res;
        } catch (GuzzleException $s) {
            Log::error("微信手机号获取异常 :{$s->getFile()}[{$s->getLine()}]:" . $s->getMessage());
            return [];
        }
    }


    /**
     * 小程序授权
     * @param string $js_code
     * @return mixed
     * @throws GuzzleException
     * @throws ServiceException
     */
    public function auth(string $js_code)
    {
        $appid   = getenv('WECHAT_MINI_APP_ID');
        $secret  = getenv('WECHAT_MINI_APP_SECRET');
        $authUrl = "https://api.weixin.qq.com/sns/jscode2session?appid={$appid}&secret={$secret}&grant_type=authorization_code&js_code={$js_code}";
        try {
            $response = $this->client->request('GET', $authUrl, [
                'headers' => [
                    'Content-Type' => 'application/x-www-form-urlencoded; charset=UTF-8',
                ],
            ]);
            $resStr   = (string)$response->getBody();
            Log::info('小程序授权获取结果', ['data' => $resStr]);
            if ($resStr) {
                return json_decode($resStr, true);
            }
            throw new  ServiceException('小程序授权失败');
        } catch (ServiceException $s) {
            Log::error("小程序授权异常 :{$s->getFile()}[{$s->getLine()}]:" . $s->getMessage());
            throw new ServiceException($s->getMessage());
        }
    }

    /**
     * 获取正式服accessToken
     * @return $this
     * @throws ServiceException
     */
    public function getProductAccessToken(): WechatMiniService
    {
        try {
            $tokenUrl = 'https://api.qanydrugs.com/jhb-dev/app/wechat/get-token';
            $response = $this->client->request('GET', $tokenUrl, [
                'headers' => [
                    'Content-Type' => 'application/x-www-form-urlencoded; charset=UTF-8',
                ],
            ]);
            $resStr   = (string)$response->getBody();
            $response = json_decode($resStr, true);
            Log::info('小程序token正式服获取结果', $response);
            if ($response && $response['code'] === 0 && $response['data']['access_token']) {
                $this->accessToken = $response['data']['access_token'];
                return $this;
            }
            throw new ServiceException('小程序token正式服获取失败');
        } catch (GuzzleException $s) {
            Log::error("小程序token正式服获取异常 :{$s->getFile()}[{$s->getLine()}]:" . $s->getMessage());
            throw new ServiceException('小程序token正式服获取异常');
        }
    }


    /**
     * 小程序 token 获取
     * @param bool $refresh
     * @return mixed
     * @throws GuzzleException
     * @throws ServiceException
     */
    public function getToken(bool $refresh = false): mixed
    {
        $appid    = getenv('WECHAT_MINI_APP_ID');
        $secret   = getenv('WECHAT_MINI_APP_SECRET');
        $cacheKey = 'app_token_' . $appid;
        $lockKey  = 'wechat_mini_token_refresh_' . $appid;
        $tokenRes = $this->getCachedToken($cacheKey);
        if ($tokenRes && !$refresh) {
            return $tokenRes;
        }
        $lock = Locker::lock($lockKey, self::TOKEN_LOCK_TTL);
        if (!$lock->acquire()) {
            $latestToken = $this->waitForTokenFromCache($cacheKey, $refresh ? null : $tokenRes);
            if ($latestToken) {
                return $latestToken;
            }
            throw new ServiceException('微信token刷新中，请稍后再试');
        }
        try {
            $latestToken = $this->getCachedToken($cacheKey);
            if ($latestToken && (!$refresh || $this->isRecentlyRefreshed($cacheKey))) {
                return $latestToken;
            }
            $wxAppTokenUrl = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={$appid}&secret={$secret}";
            $response      = $this->client->request('GET', $wxAppTokenUrl, [
                'headers' => [
                    'Content-Type' => 'application/x-www-form-urlencoded; charset=UTF-8',
                ],
            ]);
            $resStr        = (string)$response->getBody();
            Log::info('小程序token直接获取结果', ['data' => $resStr]);
            if ($resStr) {
                $tokenArr = json_decode($resStr, true);
                if (!empty($tokenArr['access_token'])) {
                    Redis::set($cacheKey, $resStr, 'EX', self::TOKEN_EXPIRE_TIME);
                    return $tokenArr;
                }
                Log::warning('小程序token刷新失败，保留旧缓存', ['appid' => $appid, 'data' => $tokenArr,]);
                $cachedToken = $this->getCachedToken($cacheKey);
                if ($cachedToken && empty($cachedToken['errcode'])) {
                    return $cachedToken;
                }
                $message = $tokenArr['errmsg'] ?? '微信token获取失败';
                throw new ServiceException($message);
            }
            throw new  ServiceException('微信token获取失败');
        } catch (ServiceException $s) {
            Log::error("小程序token获取异常 :{$s->getFile()}[{$s->getLine()}]:" . $s->getMessage());
            throw new ServiceException($s->getMessage());
        } finally {
            $lock->release();
        }
    }


    private function getCachedToken(string $cacheKey): array
    {
        $tokenRes = Redis::get($cacheKey);
        if (!$tokenRes) {
            return [];
        }
        $tokenArr = json_decode($tokenRes, true);
        if (!is_array($tokenArr) || empty($tokenArr['access_token'])) {
            return [];
        }
        return $tokenArr;
    }

    private function waitForTokenFromCache(string $cacheKey, ?array $fallback = null): array
    {
        for ($i = 0; $i < self::TOKEN_WAIT_RETRY_TIMES; $i++) {
            usleep(self::TOKEN_WAIT_INTERVAL_MICROSECONDS);
            $tokenArr = $this->getCachedToken($cacheKey);
            if ($tokenArr) {
                return $tokenArr;
            }
        }
        return $fallback ?: [];
    }

    private function isRecentlyRefreshed(string $cacheKey): bool
    {
        $ttl = Redis::ttl($cacheKey);
        if (!is_int($ttl)) {
            return false;
        }
        return $ttl >= self::TOKEN_EXPIRE_TIME - self::TOKEN_REFRESH_GRACE_SECONDS;
    }

}