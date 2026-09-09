<?php

namespace app\controller;

use Tinywan\Jwt\JwtToken;

class BaseController
{

    protected $user;


    protected function user()
    {
        if (!$this->user) {
            $this->user = JwtToken::getUser();
        }
        return $this->user;
    }


    protected function id()
    {
        return $this->user()->id;
    }


    protected function openid()
    {
        return $this->user()->openid;
    }



}