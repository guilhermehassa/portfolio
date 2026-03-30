# Guilherme Hassã - Desenvolvedor Web

Landing page comercial bilíngue (PT-BR/EN) com Tailwind CSS, tema claro/escuro e formulário PHP para envio de contato.

## Requisitos
- Node.js 18+
- npm
- PHP 8+

## Setup
1. Instalar dependências:
   npm install
2. Gerar CSS de produção:
   npm run build:css
3. Desenvolvimento com watch:
   npm run watch:css

## Execução local
Como existe endpoint PHP, rode em servidor PHP local na raiz do projeto:

php -S localhost:8080

Depois acesse:
http://localhost:8080

## Deploy na HostGator
1. Fazer upload de todos os arquivos da raiz e pasta assets.
2. Garantir que contact.php esteja na raiz publica.
3. Testar envio de formulário em produção para contato@hassa.dev.br.
4. Validar registros SPF, DKIM e DMARC do domínio.
