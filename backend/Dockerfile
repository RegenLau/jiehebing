FROM registry.cn-hangzhou.aliyuncs.com/alfred_lucky/webman:v1

LABEL maintainer="tbfollow" \
      description="tb follow" \
      version="1.0.1"

COPY my_php.ini "$PHP_INI_DIR/conf.d/my_php.ini"

COPY composer.json composer.lock ./

RUN composer config -g repos.packagist composer https://mirrors.tencent.com/composer/ \
    && composer install \
        --no-dev \
        --no-interaction \
        --no-progress \
        --prefer-dist \
        --no-autoloader \
        --no-scripts

COPY . .

RUN composer dump-autoload --optimize --no-dev

EXPOSE 8787

CMD ["php", "/www/start.php", "start"]