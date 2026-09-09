<?php

namespace app\controller;

use app\services\FileService;
use DI\Attribute\Inject;
use support\Request;
use support\Response;

class FileController
{


    private FileService $fileService;

    public function __construct()
    {
        $this->fileService = new FileService();
    }


    /**
     * @param Request $request
     * @return Response
     */
    public function uploadBase64(Request $request): Response
    {
        $image = $request->input('image');
        if (!$image) {
            return json(['code' => 1, 'data' => [], 'message' => '图片不能为空']);
        }
        $res = $this->fileService->uploadBase64('data:image/png;base64,' . $image);
        if ($res && $res['url']) {
            return json(['code' => 0, 'data' => $res, 'message' => '']);
        }
        return json(['code' => 1, 'data' => [], 'message' => '上传失败']);
    }

    public function uploadFile(Request $request): Response
    {
        $file= $request->file('file');
        if (!$file) {
            return json(['code' => 1, 'data' => [], 'message' => '文件不能为空']);
        }
        $res = $this->fileService->uploadFile($file);
        if ($res && $res['url']) {
            return json(['code' => 0, 'data' => $res, 'message' => '']);
        }
        return json(['code' => 1, 'data' => [], 'message' => '上传失败']);
    }
}