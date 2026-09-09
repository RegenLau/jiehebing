<?php

return [
    'enable' => true,
    'jwt' => [
        /** 算法类型 HS256、HS384、HS512、RS256、RS384、RS512、ES256、ES384、ES512、PS256、PS384、PS512 */
        'algorithms' => 'HS256',

        /** access令牌秘钥（安装时自动生成64位随机值） */
        'access_secret_key' => '0d596dff5295a21be0d3e7893c18018d84be5dfaa2a4cf2abfe519e847dc7e95',

        /** access令牌过期时间，单位：秒。默认 2 小时 */
        'access_exp' => 7200,

        /** refresh令牌秘钥（安装时自动生成64位随机值） */
        'refresh_secret_key' => 'c24aa6ce764dcfd96de47213705fec06a5731e9003e26cc773d8190c3c3507d6',

        /** refresh令牌过期时间，单位：秒。默认 7 天 */
        'refresh_exp' => 604800,

        /** refresh 令牌是否禁用，默认不禁用 false */
        'refresh_disable' => false,

        /** 令牌签发者 */
        'iss' => 'webman.tinywan.cn',

        /** 某个时间点后才能访问，单位秒。（如：30 表示当前时间30秒后才能使用） */
        'nbf' => 0,

        /** 时钟偏差冗余时间，单位秒。建议这个余地应该不大于几分钟 */
        'leeway' => 60,

        /** 是否允许单设备登录，默认不允许 false */
        'is_single_device' => false,

        /** 缓存令牌时间，单位：秒。默认 7 天 */
        'cache_token_ttl' => 604800,

        /** 缓存令牌前缀，默认 JWT:TOKEN: */
        'cache_token_pre' => 'JWT:TOKEN:',

        /** 缓存刷新令牌前缀，默认 JWT:REFRESH_TOKEN: */
        'cache_refresh_token_pre' => 'JWT:REFRESH_TOKEN:',

        /** 用户信息模型 */
        'user_model' => function ($uid) {
            // 返回一个对象
            return \support\Db::table('tb_user')
                ->where('id', $uid)
                ->first();
        },

        /** 是否支持 get 请求获取令牌 */
        'is_support_get_token' => false,
        /** GET 请求获取令牌请求key */
        'is_support_get_token_key' => 'authorization',

        /** access令牌私钥 */
        'access_private_key' => <<<EOD
-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----
EOD,

        /** access令牌公钥 */
        'access_public_key' => <<<EOD
-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----
EOD,

        /** refresh令牌私钥 */
        'refresh_private_key' => <<<EOD
-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----
EOD,

        /** refresh令牌公钥 */
        'refresh_public_key' => <<<EOD
-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----
EOD,
    ],
];
