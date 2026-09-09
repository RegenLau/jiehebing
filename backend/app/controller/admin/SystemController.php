<?php

namespace app\controller\admin;

use support\Request;

class SystemController extends AdminBaseController
{
    public function userInfo(Request $request): \support\Response
    {
        $admin = (array)($request->admin ?? []);

        return $this->ok([
            'id'         => $admin['id'] ?? 0,
            'username'   => $admin['username'] ?? '',
            'realname'   => $admin['username'] ?? '',
            'email'      => $admin['email'] ?? '',
            'phone'      => $admin['phone'] ?? '',
            'avatar'     => $admin['avatar'] ?? '',
            'roles'      => ['R_ADMIN'],
            'buttons'    => ['*'],
            'dashboard'  => '/dashboard/console',
            'department' => ['id' => 1, 'name' => 'Admin Team'],
        ]);
    }

    public function dictAll(): \support\Response
    {
        return $this->ok([]);
    }

    public function menu(): \support\Response
    {
        return $this->ok([
            [
                'path'      => '/dashboard',
                'name'      => 'Dashboard',
                'component' => '/index/index',
                'meta'      => [
                    'title' => 'menus.dashboard.title',
                    'icon'  => 'ri:dashboard-line',
                ],
                'children'  => [
                    [
                        'path'      => 'console',
                        'name'      => 'Console',
                        'component' => '/dashboard/console',
                        'meta'      => [
                            'title'     => 'menus.dashboard.console',
                            'keepAlive' => false,
                            'fixedTab'  => true,
                        ],
                    ],
                ],
            ],
            [
                'path'      => '/patient',
                'name'      => 'Patient',
                'component' => '/index/index',
                'meta'      => [
                    'title' => 'menus.patient.title',
                    'icon'  => 'ri:user-heart-line',
                ],
                'children'  => [
                    [
                        'path'      => 'index',
                        'name'      => 'PatientIndex',
                        'component' => '/admin/patient',
                        'meta'      => [
                            'title'     => 'menus.patient.list',
                            'keepAlive' => true,
                        ],
                    ],
                    [
                        'path'      => 'detail',
                        'name'      => 'PatientDetail',
                        'component' => '/admin/patient-detail',
                        'meta'      => [
                            'title'      => 'menus.patient.detail',
                            'keepAlive'  => false,
                            'isHide'     => true,
                            'activePath' => '/patient/index',
                        ],
                    ],
                ],
            ],
            [
                'path'      => '/medication-plan',
                'name'      => 'MedicationPlan',
                'component' => '/index/index',
                'meta'      => [
                    'title' => 'menus.medicationPlan.title',
                    'icon'  => 'ri:capsule-line',
                ],
                'children'  => [
                    [
                        'path'      => 'index',
                        'name'      => 'MedicationPlanIndex',
                        'component' => '/admin/medication-plan',
                        'meta'      => [
                            'title'     => 'menus.medicationPlan.list',
                            'keepAlive' => true,
                        ],
                    ],
                ],
            ],
            [
                'path'      => '/adverse-reaction',
                'name'      => 'AdverseReaction',
                'component' => '/index/index',
                'meta'      => [
                    'title' => 'menus.adverseReaction.title',
                    'icon'  => 'ri:alarm-warning-line',
                ],
                'children'  => [
                    [
                        'path'      => 'index',
                        'name'      => 'AdverseReactionIndex',
                        'component' => '/admin/adverse-reaction',
                        'meta'      => [
                            'title'     => 'menus.adverseReaction.list',
                            'keepAlive' => true,
                        ],
                    ],
                ],
            ],
            [
                'path'      => '/survey',
                'name'      => 'Survey',
                'component' => '/index/index',
                'meta'      => [
                    'title' => 'menus.survey.title',
                    'icon'  => 'ri:survey-line',
                ],
                'children'  => [
                    [
                        'path'      => 'index',
                        'name'      => 'SurveyIndex',
                        'component' => '/admin/survey',
                        'meta'      => [
                            'title'     => 'menus.survey.list',
                            'keepAlive' => true,
                        ],
                    ],
                ],
            ],
            [
                'path'      => '/health-article',
                'name'      => 'HealthArticle',
                'component' => '/index/index',
                'meta'      => [
                    'title' => 'menus.healthArticle.title',
                    'icon'  => 'ri:book-open-line',
                ],
                'children'  => [
                    [
                        'path'      => 'index',
                        'name'      => 'HealthArticleIndex',
                        'component' => '/admin/health-article',
                        'meta'      => [
                            'title'     => 'menus.healthArticle.list',
                            'keepAlive' => true,
                        ],
                    ],
                ],
            ],
            [
                'path'      => '/common-medicine',
                'name'      => 'CommonMedicine',
                'component' => '/index/index',
                'meta'      => [
                    'title' => 'menus.commonMedicine.title',
                    'icon'  => 'ri:medicine-bottle-line',
                ],
                'children'  => [
                    [
                        'path'      => 'index',
                        'name'      => 'CommonMedicineIndex',
                        'component' => '/admin/common-medicine',
                        'meta'      => [
                            'title'     => 'menus.commonMedicine.list',
                            'keepAlive' => true,
                        ],
                    ],
                ],
            ],
            [
                'path'      => '/admin',
                'name'      => 'Admin',
                'component' => '/index/index',
                'meta'      => [
                    'title' => 'menus.admin.title',
                    'icon'  => 'ri:admin-line',
                ],
                'children'  => [
                    [
                        'path'      => 'user',
                        'name'      => 'AdminUser',
                        'component' => '/admin/user',
                        'meta'      => [
                            'title'     => 'menus.admin.user',
                            'keepAlive' => true,
                        ],
                    ],
                ],
            ],
        ]);
    }
}
