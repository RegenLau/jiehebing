<?php

namespace app\exception;

use Webman\Http\Request;
use Webman\Http\Response;
use Exception;
use support\exception\BusinessException;
use function json_encode;

class ServiceException extends BusinessException
{
    public function render(Request $request): ?Response
    {
        $code = $this->getCode();
        $json = ['code' => $code ?: 1, 'message' => $this->getMessage(), 'data' =>[]];
        return new Response(200, ['Content-Type' => 'application/json'],
            json_encode($json, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    }
}
