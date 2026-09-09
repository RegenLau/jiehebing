<?php

namespace app\services;

use Shopwwi\WebmanFilesystem\Facade\Storage;
use support\Log;

class FileService
{

    /**
     * @param string $files
     * @return array|string[]
     */
    public function uploadBase64(string $files): array
    {
        try {
            $result = Storage::adapter('oss')->path('tb-follow')->extYes(['image/jpeg', 'image/png'])->base64Upload($files);
            return ['url' => 'https://health-h5.oss-cn-beijing.aliyuncs.com/' . $result->file_name];
        } catch (\Exception $exception) {
            Log::error('图片上传错误', ['message' => $exception->getMessage()]);
            return [];
        }
    }


    /**
     * @param $file
     * @return array|string[]
     */
    public function uploadFile($file): array
    {
        try {
            $result = Storage::adapter('oss')->path('tb-follow')->extYes(['image/jpeg', 'image/png', 'image/gif', 'application/pdf'])->upload($file);;
            return ['url' => 'https://health-h5.oss-cn-beijing.aliyuncs.com/' . $result->file_name];
        } catch (\Exception $exception) {
            Log::error('图片上传错误', ['message' => $exception->getMessage()]);
            return [];
        }
    }

}