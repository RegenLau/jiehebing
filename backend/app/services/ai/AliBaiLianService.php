<?php

namespace app\services\ai;

use GuzzleHttp\Client;
use support\Log;
use support\Request;
use support\Response;
use Webman\Openai\Chat;
use Workerman\Protocols\Http\Chunk;

class AliBaiLianService
{
    /**
     * @var string
     */
    private $appId;

    /**
     * @var string
     */
    private $host;


    /**
     * @var string
     */
    private $apiKey;


    public function __construct()
    {
        $this->appId  = 'ecd5c0e73b9b463cba6325ff4bfdce87';
        $this->host   = 'https://dashscope.aliyuncs.com/api/v1/apps/';
        $this->apiKey = 'sk-ead382075568407e9a600501fbc7a0b7';
    }


    /**
     * @param Request $request
     * @param array $params
     * @return Response
     */
    public function chatMessage(Request $request, array $params = []): Response
    {
        $query          = $params['query'] ?? 'chat';
        $commonName     = $params['commonName'] ?? '';
        $hospitalName   = $params['hospitalName'] ?? '';
        $pharmacistName = $params['pharmacistName'] ?? '';
        $conversationId = $params['conversation_id'] ?? '';
        $userName       = empty($params['userName']) ? "abc-123" : $params['userName'];
        $isSelfDrug     = $params['isSelfDrug'] ?? '0';
        $lang           = empty($params['lang']) ? null : $params['lang'];
        $doctorIns      = $params['doctorInstruction'] ?? '';
        $ybm            = $params['ybm'] ?? '';
        $specification  = $params['specification'] ?? '';
        $docId          = $params['doc_id'] ?? '';
        $connection     = $request->connection;
        $chat           = new Chat([
            'api'     => $this->host . $this->appId . '/completion',
            'apikey'  => $this->apiKey,
            'headers' => ['X-DashScope-SSE' => 'enable']
        ]);
        $specialDoc     = 0;
        $from           = '';
        $chat->completions(
            [
                "input"      => [
                    "prompt"     => $query,
                    "biz_params" => [
                        "commonName"        => $commonName,
                        'hospitalName'      => $hospitalName,
                        'pharmacistName'    => $pharmacistName,
                        'isSelfDrug'        => (string)$isSelfDrug,
                        'lang'              => $lang,
                        'doctorInstruction' => $doctorIns,
                        'ybm'               => $ybm,
                        'user'              => $userName,
                        'specification'     => $specification,
                        'doc_id'            => $docId,
                    ],
                    'session_id' => $conversationId,
                ],
                "parameters" => [
                    "flow_stream_mode" => "message_format",
                ],
                "stream"     => true,
            ],
            [
                'stream'   => function ($data) use ($connection, &$textStr, &$specialDoc, &$from, $query) {
                    //Log::info('问答结果', $data);
                    $nodeName = $data['output']['workflow_message']['node_name'] ?? '';
                    if (str_contains($nodeName, '来源：')) {
                        if (isset($data['output']['workflow_message']['message']['content']) && strpos($data['output']['workflow_message']['message']['content'], ':')) {
                            $fromDoc = explode(':', $data['output']['workflow_message']['message']['content'])[1] ?? 0;
                            $from    = explode(':', $data['output']['workflow_message']['message']['content'])[0] ?? '';
                            if ($fromDoc == 1) {
                                $specialDoc = 1;
                            }
                            $res = [
                                'text'            => '',
                                'event'           => 'message',
                                'task_id'         => $data['request_id'],
                                //todo msgid 待确认
                                'message_id'      => $data['output']['session_id'],
                                'conversation_id' => $data['output']['session_id'],
                                'special_doc'     => $specialDoc,
                                'from'            => $from,
                                'audio'           => '',
                            ];
                            $connection->send(new Chunk(json_encode($res, JSON_UNESCAPED_UNICODE) . "\n"));
                        }
                    } else {
                        if (isset($data['output']['workflow_message']['node_status'])
                            && in_array($data['output']['workflow_message']['node_status'], ['success', 'executing'])
                            && !empty($data['output']['workflow_message']['message']['content'])) {
                            $res = [
                                'text'            => $data['output']['workflow_message']['message']['content'],
                                'event'           => 'message',
                                'task_id'         => $data['request_id'],
                                'message_id'      => $data['output']['session_id'],
                                'conversation_id' => $data['output']['session_id'],
                                'special_doc'     => $specialDoc,
                                'from'            => $from,
                                'audio'           => ''
                            ];
                            $connection->send(new Chunk(json_encode($res, JSON_UNESCAPED_UNICODE) . "\n"));
                        }
                    }
                },
                'complete' => function ($result) use ($connection) {
                    if (isset($result['error'])) {
                        $queue     = 'chat_fail_notice';
                        $queueData = [
                            'message' => json_encode($result, JSON_UNESCAPED_UNICODE)
                        ];
                        \Webman\RedisQueue\Client::send($queue, $queueData);
                        $connection->send(new Chunk(json_encode($result, JSON_UNESCAPED_UNICODE) . "\n"));
                    }
                    $connection->send(new Chunk(''));
                },
            ]);
        return response()->withHeaders([
            "Content-Type"      => "text/event-stream;charset=utf-8",
            "Transfer-Encoding" => "chunked",
        ]);
    }


    /**
     * 大模型调用
     * @param string $systemPrompt
     * @param string $userContent
     * @param string $model
     * @return string
     */
    public function query(string $systemPrompt, string $userContent, string $model = 'qwen-plus'): string
    {
        try {
            $apiKey = trim((string)getenv('BAILIAN_API_KEY'));
            if ($apiKey === '') {
                Log::error('百炼调用异常', ['model' => $model, 'error' => 'BAILIAN_API_KEY 未配置']);
                return '';
            }
            $data = [
                'model' => $model,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => $systemPrompt,
                    ],
                    [
                        'role' => 'user',
                        'content' => $userContent,
                    ],
                ],
            ];
            $url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
            $client = new Client([
                'timeout' => 300,
                'connect_timeout' => 15,
            ]);
            $response = $client->post($url, [
                'headers' => [
                    'Authorization' => 'Bearer ' . $apiKey,
                    'Content-Type' => 'application/json',
                ],
                'json' => $data,
            ]);
            $res = json_decode((string)$response->getBody(), true);
            Log::info('百炼调用完成', ['model' => $model, 'has_choices' => $res]);
            if ($res && !empty($res['choices'])) {
                return (string)($res['choices'][0]['message']['content'] ?? '');
            }
            Log::error('百炼调用失败，返回为空', ['model' => $model, 'res' => $res]);
        } catch (\Throwable $e) {
            Log::error('百炼调用异常', ['model' => $model, 'error' => $e->getMessage()]);
        }
        return '';
    }
}
