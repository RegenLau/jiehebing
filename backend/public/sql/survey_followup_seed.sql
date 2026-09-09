START TRANSACTION;

INSERT INTO tb_survey_template (`code`, `name`, `description`, `fillable_day`, `status`)
VALUES (
    'TB_FOLLOWUP_V1',
    '结核病随访问卷',
    '请根据您真实感受填写，数据用于评估治疗效果。',
    7,
    1
)
ON DUPLICATE KEY UPDATE
    `name` = VALUES(`name`),
    `description` = VALUES(`description`),
    `fillable_day` = VALUES(`fillable_day`),
    `status` = VALUES(`status`);

SET @template_id := (
    SELECT `id`
    FROM tb_survey_template
    WHERE `code` = 'TB_FOLLOWUP_V1'
    LIMIT 1
);

DELETE o
FROM tb_survey_option o
INNER JOIN tb_survey_question q ON q.id = o.question_id
WHERE q.template_id = @template_id;

DELETE FROM tb_survey_question
WHERE template_id = @template_id;

INSERT INTO tb_survey_question (`template_id`, `question_no`, `title`, `type`, `required`, `sort_order`, `placeholder`)
VALUES (@template_id, 1, '您最近有无新增或减少药物？', 'RADIO', 1, 1, '');
SET @question_1_id := LAST_INSERT_ID();

INSERT INTO tb_survey_option (`question_id`, `label`, `sort_order`, `is_exclusive`, `trigger_input`, `input_fields`)
VALUES
    (@question_1_id, '首次开药', 1, 0, 0, NULL),
    (@question_1_id, '没有', 2, 0, 0, NULL),
    (@question_1_id, '有，药名：___________________', 3, 0, 1, JSON_ARRAY(
        JSON_OBJECT(
            'field_key', 'drug_name',
            'field_label', '药名',
            'field_type', 'text',
            'required', true,
            'placeholder', '请填写药名'
        )
    ));

INSERT INTO tb_survey_question (`template_id`, `question_no`, `title`, `type`, `required`, `sort_order`, `placeholder`)
VALUES (@template_id, 2, '您最近服用药物的剂量和频次是否有变化？', 'RADIO', 1, 2, '');
SET @question_2_id := LAST_INSERT_ID();

INSERT INTO tb_survey_option (`question_id`, `label`, `sort_order`, `is_exclusive`, `trigger_input`, `input_fields`)
VALUES
    (@question_2_id, '没有', 1, 0, 0, NULL),
    (@question_2_id, '有，药名：___________________频次变化：___________________', 2, 0, 1, JSON_ARRAY(
        JSON_OBJECT(
            'field_key', 'drug_name',
            'field_label', '药名',
            'field_type', 'text',
            'required', true,
            'placeholder', '请填写药名'
        ),
        JSON_OBJECT(
            'field_key', 'frequency_change',
            'field_label', '频次变化',
            'field_type', 'text',
            'required', true,
            'placeholder', '请填写频次变化'
        )
    ));

INSERT INTO tb_survey_question (`template_id`, `question_no`, `title`, `type`, `required`, `sort_order`, `placeholder`)
VALUES (@template_id, 3, '您最近有没有到医院复查？', 'RADIO', 1, 3, '');
SET @question_3_id := LAST_INSERT_ID();

INSERT INTO tb_survey_option (`question_id`, `label`, `sort_order`, `is_exclusive`, `trigger_input`, `input_fields`)
VALUES
    (@question_3_id, '没有', 1, 0, 0, NULL),
    (@question_3_id, '有，检查结果（如痰培养）：___________________', 2, 0, 1, JSON_ARRAY(
        JSON_OBJECT(
            'field_key', 'check_result',
            'field_label', '检查结果（如痰培养）',
            'field_type', 'text',
            'required', true,
            'placeholder', '请填写检查结果'
        )
    ));

INSERT INTO tb_survey_question (`template_id`, `question_no`, `title`, `type`, `required`, `sort_order`, `placeholder`)
VALUES (@template_id, 4, '服药以后有没有出现不舒服（如头晕、皮疹、恶心等）？', 'RADIO', 1, 4, '');
SET @question_4_id := LAST_INSERT_ID();

INSERT INTO tb_survey_option (`question_id`, `label`, `sort_order`, `is_exclusive`, `trigger_input`, `input_fields`)
VALUES
    (@question_4_id, '没有', 1, 0, 0, NULL),
    (@question_4_id, '有，不舒服表现：___________________', 2, 0, 1, JSON_ARRAY(
        JSON_OBJECT(
            'field_key', 'symptom',
            'field_label', '不舒服表现',
            'field_type', 'text',
            'required', true,
            'placeholder', '请填写不舒服表现'
        )
    ));

INSERT INTO tb_survey_question (`template_id`, `question_no`, `title`, `type`, `required`, `sort_order`, `placeholder`)
VALUES (@template_id, 5, '最近 2 周内，有没有以下情况？（可多选）', 'CHECKBOX', 1, 5, '');
SET @question_5_id := LAST_INSERT_ID();

INSERT INTO tb_survey_option (`question_id`, `label`, `sort_order`, `is_exclusive`, `trigger_input`, `input_fields`)
VALUES
    (@question_5_id, '忘记吃药', 1, 0, 0, NULL),
    (@question_5_id, '自己减量或停药', 2, 0, 0, NULL),
    (@question_5_id, '自行增加剂量', 3, 0, 0, NULL),
    (@question_5_id, '以上都没有', 4, 1, 0, NULL);

INSERT INTO tb_survey_question (`template_id`, `question_no`, `title`, `type`, `required`, `sort_order`, `placeholder`)
VALUES (@template_id, 6, '您最想问药师或医生的用药问题是：', 'TEXT', 0, 6, '请输入您的问题');

COMMIT;
