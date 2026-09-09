<?php

namespace app\services\ai;


use app\exception\ServiceException;
use OSS\OssClient;
use support\Log;
use yzh52521\EasyHttp\Http;

class AliDifyService
{

    /**
     * @var string
     */
    private $chatMessageToken;

    /**
     * @var string
     */
    private $host;


    public function __construct()
    {
        $this->host             = 'http://rag2.huiyitong.cn';
        $this->chatMessageToken = 'app-Ok9Tzj6HAlkCDXSXIxA8csjq';
    }

    /**
     * 处方码识别
     * @param string $image
     * @return array|mixed
     */
    public function ocr(string $image): mixed
    {
        try {
            $appid  = '21b64046d17645eeb14722184f2cd99d';
            $apiKey = 'Bearer sk-ead382075568407e9a600501fbc7a0b7';
            $url    = "https://dashscope.aliyuncs.com/api/v1/apps/$appid/completion";
            $params = [
                'input' => [
                    'prompt'     => ' ',
                    'image_list' => [$image]
                ],
            ];
            $resp   = Http::timeout(60)->withHeaders(['Authorization' => $apiKey])->asJson()->post($url, $params);
            $data   = json_decode($resp->body(), true);
            Log::info("处方识别结果", ['params' => $params, 'data' => $data]);
            if (!empty($data['output']['text'])) {
                $list = json_decode($data['output']['text'], true);
                if (!empty($list)) {
                    return $list;
                }
            }
            return [];
        } catch (\Exception $e) {
            Log::error("处方识别结果", ['message' => $e->getMessage()]);
        }
        return [];
    }
}
