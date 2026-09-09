<?php
/**
 * This file is part of webman.
 *
 * Licensed under The MIT License
 * For full copyright and license information, please see the MIT-LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @author    walkor<walkor@workerman.net>
 * @copyright walkor<walkor@workerman.net>
 * @link      http://www.workerman.net/
 * @license   http://www.opensource.org/licenses/mit-license.php MIT License
 */

use app\middleware\ArchiveMiddleware;
use app\middleware\AdminAuthMiddleware;
use app\middleware\LoginMiddleware;
use app\middleware\LoginMobileMiddleware;
use Webman\Route;

// ---------------小程序----------------------

Route::add(['GET', 'OPTIONS'], '/app/doc', [app\controller\IndexController::class, 'doc']);

Route::add(['POST', 'OPTIONS'], '/app/login', [app\controller\LoginController::class, 'login']);
Route::add(['POST', 'OPTIONS'], '/app/login-test', [app\controller\LoginController::class, 'loginTest']);

Route::add(['GET', 'OPTIONS'], '/app/wechat/get-token', [app\controller\WechatController::class, 'getAppToken']);

Route::add(['POST', 'OPTIONS'], '/app/digital/get-user-mobile', [app\controller\LoginController::class, 'getUserMobile'])
    ->middleware([LoginMiddleware::class]);

Route::group('/app/patient', function () {
    Route::add(['GET', 'OPTIONS'], '/archive-detail', [app\controller\PatientController::class, 'archiveDetail']);
    Route::add(['GET', 'OPTIONS'], '/hospital-list', [app\controller\PatientController::class, 'hospitalList']);
    Route::add(['POST', 'OPTIONS'], '/save-archive', [app\controller\PatientController::class, 'saveArchive']);

    Route::group('', function () {
        Route::add(['GET', 'OPTIONS'], '/medicine-list', [app\controller\PatientController::class, 'medicineList']);
        Route::add(['GET', 'OPTIONS'], '/medication-plan', [app\controller\PatientController::class, 'medicationPlan']);
        Route::add(['GET', 'OPTIONS'], '/today-medication-plans', [app\controller\PatientController::class, 'todayMedicationPlans']);
        Route::add(['GET', 'OPTIONS'], '/reminder-setting', [app\controller\PatientController::class, 'reminderSetting']);
        Route::add(['POST', 'OPTIONS'], '/save-reminder-setting', [app\controller\PatientController::class, 'saveReminderSetting']);
        Route::add(['POST', 'OPTIONS'], '/recognize-prescription', [app\controller\PatientController::class, 'recognizePrescription']);
        Route::add(['POST', 'OPTIONS'], '/save-medicines', [app\controller\PatientController::class, 'saveMedicines']);
        Route::add(['POST', 'OPTIONS'], '/update-medicine', [app\controller\PatientController::class, 'updateMedicine']);
        Route::add(['POST', 'OPTIONS'], '/check-medication-plan', [app\controller\PatientController::class, 'checkMedicationPlan']);
    })->middleware([ArchiveMiddleware::class]);
})->middleware([LoginMobileMiddleware::class]);

// 不良反应上报
Route::group('/app/adverse-reaction', function () {
    Route::add(['POST', 'OPTIONS'], '/report', [app\controller\AdverseReactionController::class, 'report']);
    Route::add(['GET', 'OPTIONS'], '/list', [app\controller\AdverseReactionController::class, 'reportList']);
})->middleware([LoginMobileMiddleware::class, ArchiveMiddleware::class]);

// 健康文章
Route::group('/app/health-article', function () {
    Route::add(['GET', 'OPTIONS'], '/list', [app\controller\HealthArticleController::class, 'articleList']);
    Route::add(['GET', 'OPTIONS'], '/detail', [app\controller\HealthArticleController::class, 'articleDetail']);
})->middleware([LoginMobileMiddleware::class, ArchiveMiddleware::class]);

// 随访问卷
Route::group('/app/survey', function () {
    Route::add(['GET', 'OPTIONS'], '/templates', [app\controller\SurveyController::class, 'templates']);
    Route::add(['GET', 'OPTIONS'], '/detail', [app\controller\SurveyController::class, 'detail']);
    Route::add(['POST', 'OPTIONS'], '/submit', [app\controller\SurveyController::class, 'submit']);
})->middleware([LoginMobileMiddleware::class, ArchiveMiddleware::class]);

// 问卷后台管理（复用患者端登录态）
Route::group('/app/admin/survey', function () {
    Route::add(['GET', 'OPTIONS'], '/template/list', [app\controller\SurveyAdminController::class, 'list']);
    Route::add(['GET', 'OPTIONS'], '/template/detail', [app\controller\SurveyAdminController::class, 'detail']);
    Route::add(['POST', 'OPTIONS'], '/template/save', [app\controller\SurveyAdminController::class, 'save']);
    Route::add(['POST', 'OPTIONS'], '/template/delete', [app\controller\SurveyAdminController::class, 'delete']);
    Route::add(['POST', 'OPTIONS'], '/template/toggle-status', [app\controller\SurveyAdminController::class, 'toggleStatus']);
})->middleware([LoginMiddleware::class]);

// 常用药
Route::group('/app/medicine', function () {
    Route::add(['POST', 'OPTIONS'], '/common-list', [app\controller\MedicineController::class, 'commonList']);
    Route::add(['GET', 'OPTIONS'], '/common-detail', [app\controller\MedicineController::class, 'commonDetail']);
})->middleware([LoginMobileMiddleware::class, ArchiveMiddleware::class]);

Route::add(['OPTIONS', 'POST'], '/app/file/upload-base64', [app\controller\FileController::class, 'uploadBase64']);
Route::add(['OPTIONS', 'POST'], '/app/file/upload-file', [app\controller\FileController::class, 'uploadFile']);


// ----------------管理后台----------------------

// ── 公开接口（无需登录） ─────────────────────────────────────────────────────
Route::get('/app/admin/captcha', [app\controller\admin\LoginController::class, 'captcha']);
Route::post('/app/admin/login',  [app\controller\admin\LoginController::class, 'login']);
Route::get('/app/core/captcha', [app\controller\admin\LoginController::class, 'captcha']);
Route::post('/app/core/login', [app\controller\admin\LoginController::class, 'login']);

Route::group('/app/core/system', function () {
    Route::get('/user', [app\controller\admin\SystemController::class, 'userInfo']);
    Route::get('/dictAll', [app\controller\admin\SystemController::class, 'dictAll']);
    Route::get('/menu', [app\controller\admin\SystemController::class, 'menu']);
})->middleware([AdminAuthMiddleware::class]);

Route::group('/app/core/file', function () {
    Route::post('/upload-file', [app\controller\admin\FileController::class, 'uploadFile']);
})->middleware([AdminAuthMiddleware::class]);

Route::group('/app/core/admin', function () {
    Route::get('/index', [app\controller\admin\AdminController::class, 'index']);
    Route::post('/save', [app\controller\admin\AdminController::class, 'save']);
    Route::post('/update', [app\controller\admin\AdminController::class, 'update']);
})->middleware([AdminAuthMiddleware::class]);

Route::group('/app/core/patient', function () {
    Route::get('/index', [app\controller\admin\PatientController::class, 'index']);
    Route::get('/detail', [app\controller\admin\PatientController::class, 'detail']);
    Route::get('/medicine-list', [app\controller\admin\PatientController::class, 'medicineList']);
    Route::get('/survey-status', [app\controller\admin\PatientController::class, 'surveyStatus']);
    Route::get('/survey-answer-detail', [app\controller\admin\PatientController::class, 'surveyAnswerDetail']);
})->middleware([AdminAuthMiddleware::class]);

Route::group('/app/core/adverse-reaction', function () {
    Route::get('/index', [app\controller\admin\AdverseReactionController::class, 'index']);
    Route::get('/export', [app\controller\admin\AdverseReactionController::class, 'export']);
})->middleware([AdminAuthMiddleware::class]);

Route::group('/app/core/medication-plan', function () {
    Route::get('/index', [app\controller\admin\MedicationPlanController::class, 'index']);
})->middleware([AdminAuthMiddleware::class]);

Route::group('/app/core/dashboard', function () {
    Route::get('/overview', [app\controller\admin\DashboardController::class, 'overview']);
})->middleware([AdminAuthMiddleware::class]);

Route::group('/app/core/common-medicine', function () {
    Route::get('/index', [app\controller\admin\CommonMedicineController::class, 'index']);
    Route::post('/toggle-status', [app\controller\admin\CommonMedicineController::class, 'toggleStatus']);
})->middleware([AdminAuthMiddleware::class]);

Route::group('/app/core/survey', function () {
    Route::get('/index', [app\controller\admin\SurveyController::class, 'index']);
    Route::get('/detail', [app\controller\admin\SurveyController::class, 'detail']);
    Route::get('/export', [app\controller\admin\SurveyController::class, 'export']);
    Route::post('/save', [app\controller\admin\SurveyController::class, 'save']);
    Route::post('/delete', [app\controller\admin\SurveyController::class, 'delete']);
    Route::post('/toggle-status', [app\controller\admin\SurveyController::class, 'toggleStatus']);
})->middleware([AdminAuthMiddleware::class]);

Route::group('/app/core/health-article', function () {
    Route::get('/index', [app\controller\admin\HealthArticleController::class, 'index']);
    Route::get('/detail', [app\controller\admin\HealthArticleController::class, 'detail']);
    Route::post('/save', [app\controller\admin\HealthArticleController::class, 'save']);
    Route::post('/toggle-status', [app\controller\admin\HealthArticleController::class, 'toggleStatus']);
})->middleware([AdminAuthMiddleware::class]);


Route::any('/app/admin[/{path:.+}]', function () {
    $indexPath = base_path() . '/plugin/admin/public/index.html';
    return response(file_get_contents($indexPath))
        ->withHeader('Content-Type', 'text/html; charset=utf-8');
});
