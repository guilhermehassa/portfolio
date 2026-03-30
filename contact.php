<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

function jsonResponse(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, [
        'ok' => false,
        'message' => 'Metodo nao permitido.',
    ]);
}

$honeypot = trim((string)($_POST['website'] ?? ''));
if ($honeypot !== '') {
    jsonResponse(200, [
        'ok' => true,
        'message' => 'Mensagem enviada com sucesso.',
    ]);
}

$name  = trim(strip_tags((string)($_POST['name']  ?? '')));
$email = trim((string)($_POST['email'] ?? ''));
$phone = trim(strip_tags((string)($_POST['phone'] ?? '')));
$subjectKey = trim((string)($_POST['subject'] ?? ''));

$email = str_replace(["\r", "\n"], '', $email);
$phoneDigits = preg_replace('/\D+/', '', $phone) ?? '';

$allowedSubjects = [
    'custom-project' => 'Projeto sob medida',
    'freelance' => 'Freelance sob demanda',
    'hiring' => 'Contratacao para time',
];

$errors = [];

if ($name === '' || strlen($name) < 3) {
    $errors['name'] = 'Informe um nome valido.';
}

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Informe um e-mail valido para retorno.';
}

if (strlen($phoneDigits) < 10 || strlen($phoneDigits) > 15) {
    $errors['phone'] = 'Informe um telefone valido com DDD.';
}

if (!array_key_exists($subjectKey, $allowedSubjects)) {
    $errors['subject'] = 'Selecione um assunto valido.';
}

if (!empty($errors)) {
    jsonResponse(422, [
        'ok' => false,
        'message' => 'Dados invalidos. Revise os campos e tente novamente.',
        'errors' => $errors,
    ]);
}

$to = 'contato@hassa.dev.br';
$mailSubject = '[Site] ' . $allowedSubjects[$subjectKey];

$messageLines = [
    'Novo contato recebido pelo site.',
    '',
    'Nome: ' . $name,
    'E-mail: ' . $email,
    'Telefone: ' . $phone,
    'Assunto: ' . $allowedSubjects[$subjectKey],
    '',
    'IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'desconhecido'),
    'User Agent: ' . ($_SERVER['HTTP_USER_AGENT'] ?? 'desconhecido'),
];

$message = implode(PHP_EOL, $messageLines);

$fromAddress = 'contato@hassa.dev.br';
$headers = [
    'From: Site Hassa <' . $fromAddress . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
];

$headersRaw = implode("\r\n", $headers);
$encodedSubject = '=?UTF-8?B?' . base64_encode($mailSubject) . '?=';

$sent = @mail($to, $encodedSubject, $message, $headersRaw, '-f' . $fromAddress);

if (!$sent) {
    jsonResponse(500, [
        'ok' => false,
        'message' => 'Falha ao enviar mensagem. Tente novamente em instantes.',
    ]);
}

jsonResponse(200, [
    'ok' => true,
    'message' => 'Mensagem enviada com sucesso. Retorno em breve.',
]);
