<?php

namespace app\controller\admin;

use app\services\FileService;
use support\Request;

class FileController extends AdminBaseController
{
    public function __construct(
        private readonly FileService $fileService = new FileService()
    ) {
    }

    public function uploadFile(Request $request): \support\Response
    {
        $file = $request->file('file');
        if (!$file) {
            return $this->fail('文件不能为空', 422);
        }

        $result = $this->fileService->uploadFile($file);
        if (!empty($result['url'])) {
            return $this->ok($result, '上传成功');
        }

        return $this->fail('上传失败', 500);
    }
}
