<?php

namespace app\controller;

use app\exception\ServiceException;
use app\services\patient\PatientArchiveService;
use DI\Attribute\Inject;
use Respect\Validation\Exceptions\ValidationException;
use Respect\Validation\Validator as v;
use support\Request;
use support\Response;

class PatientController extends BaseController
{
    private PatientArchiveService $patientArchiveService;

    public function __construct()
    {
        $this->patientArchiveService = new PatientArchiveService();
    }

    public function archiveDetail(): Response
    {
        $data = $this->patientArchiveService->getDetail($this->id());
        return json(['code' => 0, 'data' => $data, 'message' => '获取成功']);
    }

    public function medicineList(): Response
    {
        $data = $this->patientArchiveService->getMedicineList($this->id());
        return json(['code' => 0, 'data' => $data, 'message' => '获取成功']);
    }

    public function hospitalList(): Response
    {
        $data = $this->patientArchiveService->getHospitalList();
        return json(['code' => 0, 'data' => $data, 'message' => '获取成功']);
    }

    public function medicationPlan(): Response
    {
        $data = $this->patientArchiveService->getMedicationPlan($this->id());
        return json(['code' => 0, 'data' => $data, 'message' => '获取成功']);
    }

    public function todayMedicationPlans(): Response
    {
        $data = $this->patientArchiveService->getTodayMedicationPlans($this->id());
        return json(['code' => 0, 'data' => $data, 'message' => '获取成功']);
    }

    public function reminderSetting(): Response
    {
        $data = $this->patientArchiveService->getReminderSetting($this->id());
        return json(['code' => 0, 'data' => $data, 'message' => '获取成功']);
    }

    public function saveArchive(Request $request): Response
    {
        try {
            $data                = v::input($request->post(), [
                'hospital_id'     => v::oneOf(v::nullType(), v::digit()->notEmpty())->setName('就诊医院ID'),
                'hospital_name'   => v::stringType()->length(1, 100)->setName('就诊医院'),
                'department_name' => v::stringType()->length(1, 100)->setName('就诊科室'),
                'visit_type'      => v::digit()->in(['1', '2'])->setName('就诊类型'),
                'name'            => v::optional(v::stringType()->length(1, 100))->setName('姓名'),
                'gender'          => v::digit()->in(['1', '2'])->setName('性别'),
                'age'             => v::digit()->setName('年龄'),
            ]);
            $data['hospital_id'] = empty($data['hospital_id']) ? null : (int)$data['hospital_id'];
            $data['visit_type']  = (int)$data['visit_type'];
            $data['gender']      = (int)$data['gender'];
            $data['age']         = (int)$data['age'];
            $data['name']        = empty($data['name']) ? '' : $data['name'];
            if ($data['age'] < 0 || $data['age'] > 120) {
                throw new ServiceException('年龄格式不正确');
            }
        } catch (ValidationException|ServiceException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }
        $result = $this->patientArchiveService->save($this->id(), $data);
        return json(['code' => 0, 'data' => $result, 'message' => '保存成功']);
    }

    public function saveReminderSetting(Request $request): Response
    {
        try {
            $data = v::input($request->post(), [
                'breakfast_time' => v::stringType()->regex('/^(?:[01]\d|2[0-3]):[0-5]\d$/')->setName('早餐时间'),
                'lunch_time'     => v::stringType()->regex('/^(?:[01]\d|2[0-3]):[0-5]\d$/')->setName('午餐时间'),
                'dinner_time'    => v::stringType()->regex('/^(?:[01]\d|2[0-3]):[0-5]\d$/')->setName('晚餐时间'),
                'sleep_time'     => v::stringType()->regex('/^(?:[01]\d|2[0-3]):[0-5]\d$/')->setName('睡觉时间'),
            ]);
        } catch (ValidationException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }

        $result = $this->patientArchiveService->saveReminderSetting($this->id(), $data);
        return json(['code' => 0, 'data' => $result, 'message' => '保存成功']);
    }

    public function recognizePrescription(Request $request): Response
    {
        try {
            $data   = v::input($request->post(), [
                'image' => v::stringType()->length(1, null)->setName('处方图片')
            ]);
            $result = $this->patientArchiveService->recognizePrescription($data['image']);
        } catch (ValidationException|ServiceException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }
        return json(['code' => 0, 'data' => $result, 'message' => '识别成功']);
    }

    public function saveMedicines(Request $request): Response
    {
        try {
            $data                = v::input($request->post(), [
                'medicines' => v::arrayType()->setName('药品列表'),
            ]);
            $normalizedMedicines = [];
            foreach ($data['medicines'] as $index => $item) {
                if (!is_array($item)) {
                    throw new ServiceException('第' . ($index + 1) . '个药品格式不正确');
                }
                $medicine                  = v::input($item, [
                    'name'          => v::stringType()->length(1, 100)->setName('药品名称' . ($index + 1)),
                    'specification' => v::oneOf(v::nullType(), v::stringType()->length(0, 100))->setName('规格' . ($index + 1)),
                    'usage'         => v::oneOf(v::nullType(), v::stringType()->length(0, 100))->setName('服用方式' . ($index + 1)),
                    'frequency'     => v::oneOf(v::nullType(), v::intVal()->min(1)->max(24))->setName('用药频次' . ($index + 1)),
                    'dosage'        => v::oneOf(v::nullType(), v::stringType()->length(0, 100))->setName('每次剂量' . ($index + 1)),
                    'dosage_value'  => v::oneOf(v::nullType(), v::stringType()->length(0, 20))->setName('每次剂量数量' . ($index + 1)),
                    'dosage_unit'   => v::oneOf(v::nullType(), v::stringType()->length(0, 20))->setName('每次剂量单位' . ($index + 1)),
                    'remark'        => v::oneOf(v::nullType(), v::stringType()->length(0, 255))->setName('备注' . ($index + 1)),
                    'trade_name'    => v::oneOf(v::nullType(), v::stringType()->length(0, 100))->setName('商品名' . ($index + 1)),
                    'company'       => v::oneOf(v::nullType(), v::stringType()->length(0, 100))->setName('厂家' . ($index + 1)),
                    'medicine_count'=> v::oneOf(v::nullType(), v::stringType()->length(0, 100))->setName('数量' . ($index + 1)),
                    'ybm'           => v::oneOf(v::nullType(), v::stringType()->length(0, 100))->setName('药品医保码' . ($index + 1)),
                    'thumb'         => v::oneOf(v::nullType(), v::stringType()->length(0, 255))->setName('药品图片' . ($index + 1)),
                    'source'        => v::oneOf(v::nullType(), v::stringType()->in(['manual', 'ocr']))->setName('药品来源' . ($index + 1)),
                ]);
                $medicine['specification'] = $medicine['specification'] ?? '';
                $medicine['usage']         = $medicine['usage'] ?? '';
                $medicine['frequency']     = isset($medicine['frequency']) && $medicine['frequency'] !== null ? (int)$medicine['frequency'] : 1;
                $medicine['dosage']        = $medicine['dosage'] ?? '';
                $medicine['dosage_value']  = $medicine['dosage_value'] ?? '';
                $medicine['dosage_unit']   = $medicine['dosage_unit'] ?? '';
                $medicine['remark']        = $medicine['remark'] ?? '';
                $medicine['trade_name']    = $medicine['trade_name'] ?? '';
                $medicine['company']       = $medicine['company'] ?? '';
                $medicine['medicine_count']= $medicine['medicine_count'] ?? '';
                $medicine['ybm']           = $medicine['ybm'] ?? '';
                $medicine['thumb']         = $medicine['thumb'] ?? '';
                $medicine['source']        = $medicine['source'] ?: 'manual';
                $normalizedMedicines[]     = $medicine;
            }
        } catch (ValidationException|ServiceException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }
        $result = $this->patientArchiveService->saveMedicines($this->id(), $normalizedMedicines);
        return json(['code' => 0, 'data' => $result, 'message' => '保存成功']);
    }

    public function updateMedicine(Request $request): Response
    {
        try {
            $data                  = v::input($request->post(), [
                'id'            => v::digit()->setName('药品ID'),
                'name'          => v::stringType()->length(1, 100)->setName('药品名称'),
                'specification' => v::oneOf(v::nullType(), v::stringType()->length(0, 100))->setName('规格'),
                'usage'         => v::oneOf(v::nullType(), v::stringType()->length(0, 100))->setName('服用方式'),
                'frequency'     => v::oneOf(v::nullType(), v::intVal()->min(1)->max(24))->setName('用药频次'),
                'dosage'        => v::oneOf(v::nullType(), v::stringType()->length(0, 100))->setName('每次剂量'),
                'dosage_value'  => v::oneOf(v::nullType(), v::stringType()->length(0, 20))->setName('每次剂量数量'),
                'dosage_unit'   => v::oneOf(v::nullType(), v::stringType()->length(0, 20))->setName('每次剂量单位'),
                'remark'        => v::oneOf(v::nullType(), v::stringType()->length(0, 255))->setName('备注'),
                'trade_name'    => v::oneOf(v::nullType(), v::stringType()->length(0, 100))->setName('商品名'),
                'company'       => v::oneOf(v::nullType(), v::stringType()->length(0, 100))->setName('厂家'),
                'medicine_count'=> v::oneOf(v::nullType(), v::stringType()->length(0, 100))->setName('数量'),
                'ybm'           => v::oneOf(v::nullType(), v::stringType()->length(0, 100))->setName('药品医保码'),
                'thumb'         => v::oneOf(v::nullType(), v::stringType()->length(0, 255))->setName('药品图片'),
            ]);
            $data['id']            = (int)$data['id'];
            $data['specification'] = $data['specification'] ?? '';
            $data['usage']         = $data['usage'] ?? '';
            $data['frequency']     = isset($data['frequency']) && $data['frequency'] !== null ? (int)$data['frequency'] : 1;
            $data['dosage']        = $data['dosage'] ?? '';
            $data['dosage_value']  = $data['dosage_value'] ?? '';
            $data['dosage_unit']   = $data['dosage_unit'] ?? '';
            $data['remark']        = $data['remark'] ?? '';
            $data['trade_name']    = $data['trade_name'] ?? '';
            $data['company']       = $data['company'] ?? '';
            $data['medicine_count']= $data['medicine_count'] ?? '';
            $data['ybm']           = $data['ybm'] ?? '';
            $data['thumb']         = $data['thumb'] ?? '';
        } catch (ValidationException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }
        $result = $this->patientArchiveService->updateMedicine($this->id(), $data['id'], $data);
        return json(['code' => 0, 'data' => $result, 'message' => '修改成功']);
    }

    public function checkMedicationPlan(Request $request): Response
    {
        try {
            $data = v::input($request->post(), [
                'plan_id' => v::digit()->setName('计划ID'),
            ]);
        } catch (ValidationException $e) {
            return json(['code' => 1, 'data' => [], 'message' => $e->getMessage()]);
        }

        $result = $this->patientArchiveService->checkMedicationPlan($this->id(), (int)$data['plan_id']);
        return json(['code' => 0, 'data' => $result, 'message' => '打卡成功']);
    }
}
