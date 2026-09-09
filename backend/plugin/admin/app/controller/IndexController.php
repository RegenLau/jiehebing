<?php

namespace plugin\admin\app\controller;

use support\Request;

class IndexController
{

    public function index()
    {
        return view('index/index', ['name' => 'admin']);
    }

}
