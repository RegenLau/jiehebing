<?php

namespace app\controller\admin;

use app\exception\ServiceException;
use app\model\AdminModel;
use support\Request;

class AdminController extends AdminBaseController
{
    public function index(): \support\Response
    {
        $list = AdminModel::query()
            ->orderByDesc('id')
            ->get(['id', 'username', 'phone', 'email', 'avatar', 'status', 'created_at', 'updated_at'])
            ->toArray();

        return $this->ok($list);
    }

    public function save(Request $request): \support\Response
    {
        $data = $request->post();
        $username = trim((string)($data['username'] ?? ''));
        $password = (string)($data['password'] ?? '');

        try {
            if ($username === '') {
                throw new ServiceException('用户名不能为空', 422);
            }
            if ($password === '') {
                throw new ServiceException('密码不能为空', 422);
            }
            if (AdminModel::query()->where('username', $username)->exists()) {
                throw new ServiceException('用户名已存在', 422);
            }

            $admin = AdminModel::query()->create([
                'username' => $username,
                'password' => password_hash($password, PASSWORD_DEFAULT),
                'phone'    => trim((string)($data['phone'] ?? '')),
                'email'    => trim((string)($data['email'] ?? '')),
                'avatar'   => trim((string)($data['avatar'] ?? '')),
                'status'   => (int)($data['status'] ?? 1),
            ]);

            return $this->ok($admin->only(['id', 'username', 'phone', 'email', 'avatar', 'status', 'created_at', 'updated_at']), '新增成功');
        } catch (ServiceException $e) {
            return $this->fail($e->getMessage(), $e->getCode());
        }
    }

    public function update(Request $request): \support\Response
    {
        $data = $request->post();
        $id = (int)($data['id'] ?? 0);
        $username = trim((string)($data['username'] ?? ''));

        try {
            if ($id <= 0) {
                throw new ServiceException('管理员ID不能为空', 422);
            }
            if ($username === '') {
                throw new ServiceException('用户名不能为空', 422);
            }

            $admin = AdminModel::query()->find($id);
            if (!$admin) {
                throw new ServiceException('管理员不存在', 404);
            }
            if (AdminModel::query()->where('username', $username)->where('id', '<>', $id)->exists()) {
                throw new ServiceException('用户名已存在', 422);
            }

            $payload = [
                'username' => $username,
                'phone'    => trim((string)($data['phone'] ?? '')),
                'email'    => trim((string)($data['email'] ?? '')),
                'avatar'   => trim((string)($data['avatar'] ?? '')),
                'status'   => (int)($data['status'] ?? 1),
            ];

            $password = trim((string)($data['password'] ?? ''));
            if ($password !== '') {
                $payload['password'] = password_hash($password, PASSWORD_DEFAULT);
            }

            $admin->fill($payload);
            $admin->save();

            return $this->ok($admin->only(['id', 'username', 'phone', 'email', 'avatar', 'status', 'created_at', 'updated_at']), '更新成功');
        } catch (ServiceException $e) {
            return $this->fail($e->getMessage(), $e->getCode());
        }
    }
}
