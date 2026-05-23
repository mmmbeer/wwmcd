<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

const AI_PROVIDERS = [
    'groq' => [
        'label' => 'Groq',
        'base_url' => 'https://api.groq.com/openai/v1',
        'key_env' => 'NOTWITHSTANDING_GROQ_API_KEY',
        'base_env' => 'NOTWITHSTANDING_GROQ_BASE_URL',
    ],
    'openai' => [
        'label' => 'OpenAI',
        'base_url' => 'https://api.openai.com/v1',
        'key_env' => 'NOTWITHSTANDING_OPENAI_API_KEY',
        'base_env' => 'NOTWITHSTANDING_OPENAI_BASE_URL',
    ],
];

function send_json(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function send_error(int $status, string $message): void
{
    send_json($status, [
        'ok' => false,
        'error' => ['message' => $message],
    ]);
}

function provider_id(): string
{
    $provider = $_GET['provider'] ?? 'groq';
    if (!is_string($provider) || !isset(AI_PROVIDERS[$provider])) {
        send_error(400, 'Unsupported AI provider.');
    }

    return $provider;
}

function provider_config(string $provider): array
{
    $definition = AI_PROVIDERS[$provider];
    $localConfigPath = __DIR__ . '/ai-config.local.php';
    $localConfig = is_file($localConfigPath) ? require $localConfigPath : [];
    if (!is_array($localConfig)) {
        $localConfig = [];
    }

    $apiKey = getenv($definition['key_env']);
    if (!$apiKey && isset($_SERVER[$definition['key_env']])) {
        $apiKey = $_SERVER[$definition['key_env']];
    }
    if (!$apiKey && isset($localConfig[$provider . '_api_key'])) {
        $apiKey = (string) $localConfig[$provider . '_api_key'];
    }

    $baseUrl = getenv($definition['base_env']);
    if (!$baseUrl && isset($_SERVER[$definition['base_env']])) {
        $baseUrl = $_SERVER[$definition['base_env']];
    }
    if (!$baseUrl && isset($localConfig[$provider . '_base_url'])) {
        $baseUrl = (string) $localConfig[$provider . '_base_url'];
    }

    return [
        'label' => $definition['label'],
        'api_key' => trim((string) $apiKey),
        'base_url' => rtrim(trim((string) ($baseUrl ?: $definition['base_url'])), '/'),
    ];
}

function request_api_key(): string
{
    foreach (['HTTP_X_NOTWITHSTANDING_AI_API_KEY', 'HTTP_X_NOTWITHSTANDING_GROQ_API_KEY'] as $header) {
        $value = $_SERVER[$header] ?? '';
        if (is_string($value) && trim($value) !== '') {
            return trim($value);
        }
    }

    return '';
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        send_error(400, 'Request body must be valid JSON.');
    }

    return $payload;
}

function create_ai_request(string $method, string $url, string $apiKey, ?array $body = null)
{
    if (!function_exists('curl_init')) {
        send_error(500, 'PHP cURL is required for the AI proxy.');
    }

    $handle = curl_init($url);
    if ($handle === false) {
        send_error(500, 'Unable to initialize the AI proxy request.');
    }

    $headers = [
        'Accept: application/json',
        'Authorization: Bearer ' . $apiKey,
    ];

    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
    }

    curl_setopt_array($handle, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 45,
    ]);

    if ($body !== null) {
        curl_setopt($handle, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_SLASHES));
    }

    return $handle;
}

function execute_ai_request(string $method, string $path, array $config, string $apiKey, ?array $body = null): array
{
    $handle = create_ai_request($method, $config['base_url'] . '/' . ltrim($path, '/'), $apiKey, $body);
    $responseBody = curl_exec($handle);

    if ($responseBody === false) {
        $message = curl_error($handle) ?: 'The AI proxy could not reach the provider.';
        curl_close($handle);
        send_error(502, $message);
    }

    $status = curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);

    $payload = json_decode((string) $responseBody, true);
    if (!is_array($payload)) {
        send_error(502, $config['label'] . ' returned an invalid JSON response.');
    }

    return [
        'status' => (int) $status,
        'payload' => $payload,
    ];
}

function normalize_models(array $payload): array
{
    $models = [];
    $data = $payload['data'] ?? [];
    if (!is_array($data)) {
        return $models;
    }

    foreach ($data as $entry) {
        if (!is_array($entry) || empty($entry['id']) || !is_string($entry['id'])) {
            continue;
        }

        $models[] = [
            'id' => $entry['id'],
            'ownedBy' => isset($entry['owned_by']) && is_string($entry['owned_by']) ? $entry['owned_by'] : null,
        ];
    }

    usort($models, static fn(array $left, array $right): int => strcmp($left['id'], $right['id']));

    return $models;
}

function extract_text_from_completion(array $payload): string
{
    $choices = $payload['choices'] ?? [];
    if (!is_array($choices) || !isset($choices[0]) || !is_array($choices[0])) {
        send_error(502, 'The AI provider returned no completion choices.');
    }

    $message = $choices[0]['message'] ?? null;
    if (!is_array($message)) {
        send_error(502, 'The AI provider returned an invalid completion payload.');
    }

    $content = $message['content'] ?? null;
    if (is_string($content)) {
        return trim($content);
    }

    if (is_array($content)) {
        $parts = [];
        foreach ($content as $entry) {
            if (is_array($entry) && ($entry['type'] ?? null) === 'text' && isset($entry['text']) && is_string($entry['text'])) {
                $parts[] = $entry['text'];
            }
        }

        return trim(implode("\n", $parts));
    }

    send_error(502, 'The AI provider returned no text content.');
}

function normalize_response_format($value): ?array
{
    if ($value === null) {
        return null;
    }

    if (!is_array($value) || !isset($value['type']) || !is_string($value['type'])) {
        send_error(400, 'responseFormat must be an object with a string type.');
    }

    if ($value['type'] === 'json_object') {
        return ['type' => 'json_object'];
    }

    if ($value['type'] !== 'json_schema') {
        send_error(400, 'Unsupported responseFormat type.');
    }

    $jsonSchema = $value['json_schema'] ?? null;
    if (!is_array($jsonSchema) || !isset($jsonSchema['name'], $jsonSchema['schema'])) {
        send_error(400, 'json_schema responseFormat requires name and schema.');
    }

    $normalized = [
        'type' => 'json_schema',
        'json_schema' => [
            'name' => (string) $jsonSchema['name'],
            'schema' => $jsonSchema['schema'],
        ],
    ];

    if (isset($jsonSchema['strict'])) {
        $normalized['json_schema']['strict'] = (bool) $jsonSchema['strict'];
    }

    return $normalized;
}

function normalized_messages($messages): array
{
    if (!is_array($messages) || count($messages) === 0) {
        send_error(400, 'At least one chat message is required.');
    }

    $normalized = [];
    foreach ($messages as $message) {
        if (!is_array($message)) {
            continue;
        }

        $role = $message['role'] ?? null;
        $content = $message['content'] ?? null;
        if (!is_string($role) || !in_array($role, ['system', 'user', 'assistant'], true) || !is_string($content) || trim($content) === '') {
            continue;
        }

        $normalized[] = [
            'role' => $role,
            'content' => trim($content),
        ];
    }

    if (count($normalized) === 0) {
        send_error(400, 'No valid chat messages were provided.');
    }

    return $normalized;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$provider = provider_id();
$config = provider_config($provider);
$resolvedApiKey = request_api_key() ?: $config['api_key'];

if ($resolvedApiKey === '') {
    send_error(400, 'A ' . $config['label'] . ' API key is required. Save one in AI Options.');
}

$action = $_GET['action'] ?? null;
$body = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = read_json_body();
    if ($action === null && isset($body['action']) && is_string($body['action'])) {
        $action = $body['action'];
    }
}

if ($action === 'models' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $response = execute_ai_request('GET', '/models', $config, $resolvedApiKey);
    $status = $response['status'];
    $payload = $response['payload'];

    if ($status < 200 || $status >= 300) {
        $message = $payload['error']['message'] ?? $config['label'] . ' model listing failed.';
        send_error($status, is_string($message) ? $message : $config['label'] . ' model listing failed.');
    }

    send_json(200, [
        'ok' => true,
        'provider' => $provider,
        'models' => normalize_models($payload),
    ]);
}

if ($action === 'chat' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $model = isset($body['model']) && is_string($body['model']) ? trim($body['model']) : '';
    if ($model === '') {
        send_error(400, 'An AI model is required.');
    }

    $requestBody = [
        'model' => $model,
        'temperature' => max(0.1, min(2.0, isset($body['temperature']) && is_numeric($body['temperature']) ? (float) $body['temperature'] : 0.2)),
        'messages' => normalized_messages($body['messages'] ?? null),
    ];

    $responseFormat = normalize_response_format($body['responseFormat'] ?? null);
    if ($responseFormat !== null) {
        $requestBody['response_format'] = $responseFormat;
    }

    $response = execute_ai_request('POST', '/chat/completions', $config, $resolvedApiKey, $requestBody);
    $status = $response['status'];
    $payload = $response['payload'];

    if ($status < 200 || $status >= 300) {
        $message = $payload['error']['message'] ?? $config['label'] . ' chat completion failed.';
        send_error($status, is_string($message) ? $message : $config['label'] . ' chat completion failed.');
    }

    send_json(200, [
        'ok' => true,
        'provider' => $provider,
        'model' => isset($payload['model']) && is_string($payload['model']) ? $payload['model'] : $model,
        'text' => extract_text_from_completion($payload),
    ]);
}

send_error(404, 'Unknown AI proxy action.');
