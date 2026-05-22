<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

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
        'error' => [
            'message' => $message,
        ],
    ]);
}

function get_config(): array
{
    $localConfigPath = __DIR__ . '/groq-config.local.php';
    $localConfig = is_file($localConfigPath) ? require $localConfigPath : [];

    $apiKey = getenv('NOTWITHSTANDING_GROQ_API_KEY');
    if (!$apiKey && isset($_SERVER['NOTWITHSTANDING_GROQ_API_KEY'])) {
        $apiKey = $_SERVER['NOTWITHSTANDING_GROQ_API_KEY'];
    }

    if (!$apiKey && isset($localConfig['groq_api_key'])) {
        $apiKey = (string) $localConfig['groq_api_key'];
    }

    $baseUrl = getenv('NOTWITHSTANDING_GROQ_BASE_URL');
    if (!$baseUrl && isset($_SERVER['NOTWITHSTANDING_GROQ_BASE_URL'])) {
        $baseUrl = $_SERVER['NOTWITHSTANDING_GROQ_BASE_URL'];
    }

    if (!$baseUrl && isset($localConfig['groq_base_url'])) {
        $baseUrl = (string) $localConfig['groq_base_url'];
    }

    return [
        'api_key' => trim((string) $apiKey),
        'base_url' => rtrim(trim((string) ($baseUrl ?: DEFAULT_GROQ_BASE_URL)), '/'),
    ];
}

function get_request_api_key(): string
{
    $headerValue = $_SERVER['HTTP_X_NOTWITHSTANDING_GROQ_API_KEY'] ?? '';
    if (is_string($headerValue) && trim($headerValue) !== '') {
        return trim($headerValue);
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

function create_groq_request(string $method, string $url, string $apiKey, ?array $body = null)
{
    if (!function_exists('curl_init')) {
        send_error(500, 'PHP cURL is required for the Notwithstanding Groq proxy.');
    }

    $handle = curl_init($url);
    if ($handle === false) {
        send_error(500, 'Unable to initialize the Notwithstanding Groq proxy request.');
    }

    $headers = [
        'Accept: application/json',
        'Authorization: Bearer ' . $apiKey,
    ];

    curl_setopt_array($handle, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);

    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($handle, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($handle, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_SLASHES));
    }

    return $handle;
}

function execute_groq_request(string $method, string $path, string $apiKey, ?array $body = null): array
{
    $config = get_config();
    $baseUrl = $config['base_url'];
    $url = $baseUrl . '/' . ltrim($path, '/');
    $handle = create_groq_request($method, $url, $apiKey, $body);
    $responseBody = curl_exec($handle);

    if ($responseBody === false) {
        $message = curl_error($handle) ?: 'The Notwithstanding Groq proxy could not reach Groq.';
        curl_close($handle);
        send_error(502, $message);
    }

    $status = curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);

    $payload = json_decode((string) $responseBody, true);
    if (!is_array($payload)) {
        send_error(502, 'Groq returned an invalid JSON response.');
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
        send_error(502, 'Groq returned no completion choices.');
    }

    $message = $choices[0]['message'] ?? null;
    if (!is_array($message)) {
        send_error(502, 'Groq returned an invalid completion payload.');
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

    send_error(502, 'Groq returned no text content.');
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
        return [
            'type' => 'json_object',
        ];
    }

    if ($value['type'] !== 'json_schema') {
        send_error(400, 'Unsupported responseFormat type.');
    }

    $jsonSchema = $value['json_schema'] ?? null;
    if (!is_array($jsonSchema)) {
        send_error(400, 'json_schema responseFormat requires a json_schema object.');
    }

    $name = $jsonSchema['name'] ?? null;
    $schema = $jsonSchema['schema'] ?? null;
    $strict = $jsonSchema['strict'] ?? null;

    if (!is_string($name) || trim($name) === '') {
        send_error(400, 'json_schema responseFormat requires a non-empty name.');
    }

    if (!is_array($schema)) {
        send_error(400, 'json_schema responseFormat requires a schema object.');
    }

    $normalized = [
        'type' => 'json_schema',
        'json_schema' => [
            'name' => trim($name),
            'schema' => $schema,
        ],
    ];

    if ($strict !== null) {
        if (!is_bool($strict)) {
            send_error(400, 'json_schema.strict must be a boolean when provided.');
        }

        $normalized['json_schema']['strict'] = $strict;
    }

    return $normalized;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$config = get_config();
$requestApiKey = get_request_api_key();
$resolvedApiKey = $requestApiKey !== '' ? $requestApiKey : $config['api_key'];

if ($resolvedApiKey === '') {
    send_error(400, 'A Groq API key is required. Save one in Preferences to enable Groq.');
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
    $response = execute_groq_request('GET', '/models', $resolvedApiKey);
    $status = $response['status'];
    $payload = $response['payload'];

    if ($status < 200 || $status >= 300) {
        $message = $payload['error']['message'] ?? 'Groq model listing failed.';
        send_error($status, is_string($message) ? $message : 'Groq model listing failed.');
    }

    send_json(200, [
        'ok' => true,
        'models' => normalize_models($payload),
    ]);
}

if ($action === 'chat' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $model = isset($body['model']) && is_string($body['model']) ? trim($body['model']) : '';
    $temperature = isset($body['temperature']) && is_numeric($body['temperature']) ? (float) $body['temperature'] : 0.2;
    $messages = $body['messages'] ?? null;
    $responseFormat = normalize_response_format($body['responseFormat'] ?? null);

    if ($model === '') {
        send_error(400, 'A Groq model is required.');
    }

    if (!is_array($messages) || count($messages) === 0) {
        send_error(400, 'At least one chat message is required.');
    }

    $normalizedMessages = [];
    foreach ($messages as $message) {
        if (!is_array($message)) {
            continue;
        }

        $role = $message['role'] ?? null;
        $content = $message['content'] ?? null;

        if (!is_string($role) || !in_array($role, ['system', 'user', 'assistant'], true) || !is_string($content) || trim($content) === '') {
            continue;
        }

        $normalizedMessages[] = [
            'role' => $role,
            'content' => trim($content),
        ];
    }

    if (count($normalizedMessages) === 0) {
        send_error(400, 'No valid chat messages were provided.');
    }

    $requestBody = [
        'model' => $model,
        'temperature' => max(0.1, min(2.0, $temperature)),
        'messages' => $normalizedMessages,
    ];

    if ($responseFormat !== null) {
        $requestBody['response_format'] = $responseFormat;
    }

    $response = execute_groq_request('POST', '/chat/completions', $resolvedApiKey, $requestBody);
    $status = $response['status'];
    $payload = $response['payload'];

    if ($status < 200 || $status >= 300) {
        $message = $payload['error']['message'] ?? 'Groq chat completion failed.';
        send_error($status, is_string($message) ? $message : 'Groq chat completion failed.');
    }

    send_json(200, [
        'ok' => true,
        'model' => isset($payload['model']) && is_string($payload['model']) ? $payload['model'] : $model,
        'text' => extract_text_from_completion($payload),
    ]);
}

send_error(404, 'Unknown Notwithstanding Groq proxy action.');
