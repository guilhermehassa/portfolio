<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

function logContactEvent(string $event, array $context = []): void
{
    $logLine = '[' . date('Y-m-d H:i:s') . '] ' . $event;
    if (!empty($context)) {
        $encodedContext = json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (is_string($encodedContext)) {
            $logLine .= ' ' . $encodedContext;
        }
    }

    $logLine .= PHP_EOL;
    $logPath = __DIR__ . DIRECTORY_SEPARATOR . 'contact-mail.log';
    $written = @file_put_contents($logPath, $logLine, FILE_APPEND | LOCK_EX);
    if ($written === false) {
        error_log(rtrim($logLine));
    }
}

function jsonResponse(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    logContactEvent('method_not_allowed', [
        'method' => $_SERVER['REQUEST_METHOD'] ?? 'unknown',
    ]);
    jsonResponse(405, [
        'ok' => false,
        'message' => 'Metodo nao permitido.',
    ]);
}

$honeypot = trim((string)($_POST['website'] ?? ''));
if ($honeypot !== '') {
    logContactEvent('honeypot_filled', [
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
    ]);
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

logContactEvent('contact_request_received', [
    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
    'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
    'nameLength' => strlen($name),
    'emailDomain' => strpos($email, '@') !== false ? substr(strrchr($email, '@'), 1) : '',
    'phoneDigits' => strlen($phoneDigits),
    'subject' => $subjectKey,
]);

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
    logContactEvent('validation_failed', [
        'errors' => $errors,
    ]);
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
    logContactEvent('mail_send_retry_without_envelope_from', [
        'fromAddress' => $fromAddress,
    ]);
    $sent = @mail($to, $encodedSubject, $message, $headersRaw);
}

if (!$sent) {
    $lastError = error_get_last();
    logContactEvent('mail_send_failed', [
        'to' => $to,
        'subject' => $mailSubject,
        'sendmailPath' => (string)ini_get('sendmail_path'),
        'smtp' => (string)ini_get('SMTP'),
        'lastError' => $lastError['message'] ?? null,
    ]);
    jsonResponse(500, [
        'ok' => false,
        'message' => 'Falha ao enviar mensagem. Tente novamente em instantes.',
    ]);
}

logContactEvent('mail_send_success', [
    'to' => $to,
    'subject' => $mailSubject,
]);

jsonResponse(200, [
    'ok' => true,
    'message' => 'Mensagem enviada com sucesso. Retorno em breve.',
]);
