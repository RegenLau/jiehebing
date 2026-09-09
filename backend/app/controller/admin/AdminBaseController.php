<?php

namespace app\controller\admin;

class AdminBaseController
{
    protected function ok(mixed $data = [], string $message = 'success'): \support\Response
    {
        return json(['code' => 200, 'message' => $message, 'data' => $data]);
    }

    protected function fail(string $message, int $code = 400): \support\Response
    {
        return json(['code' => $code, 'message' => $message, 'data' => null]);
    }
}
