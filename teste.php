<?php
// Exibe informações completas do PHP
echo "<h2>phpinfo()</h2>";
phpinfo();

echo "<hr><h2>Configuração de E-mail</h2>";
echo '<pre>';
echo "sendmail_path: ", ini_get('sendmail_path'), "\n";
echo "SMTP: ", ini_get('SMTP'), "\n";
echo "smtp_port: ", ini_get('smtp_port'), "\n";
echo "sendmail_from: ", ini_get('sendmail_from'), "\n";
echo "mail.add_x_header: ", ini_get('mail.add_x_header'), "\n";
echo "mail.log: ", ini_get('mail.log'), "\n";
echo '</pre>';

echo "<hr><h2>Testando função mail()</h2>";
$to = 'contato@hassa.dev.br'; // Troque para seu e-mail real
$subject = 'Teste de envio de e-mail via PHP';
$message = "Este é um teste de envio de e-mail via PHP.\n\n" . date('Y-m-d H:i:s');
$headers = 'From: debug@hassa.dev.br' . "\r\n" .
		   'Reply-To: debug@hassa.dev.br' . "\r\n" .
		   'X-Mailer: PHP/' . phpversion();

$mailResult = mail($to, $subject, $message, $headers);
if ($mailResult) {
	echo '<p style="color:green">E-mail enviado com sucesso!</p>';
} else {
	echo '<p style="color:red">Falha ao enviar e-mail.</p>';
	$lastError = error_get_last();
	if ($lastError) {
		echo '<pre>Erro: ' . print_r($lastError, true) . '</pre>';
	}
}

echo '<hr><h2>Módulos PHP instalados</h2>';
echo '<pre>';
print_r(get_loaded_extensions());
echo '</pre>';

// Fim do script de debug
