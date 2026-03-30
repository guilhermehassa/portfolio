# Plano de Implementacao

Este projeto segue execucao orientada por documentacao para a LP de Guilherme Hassã - Desenvolvedor Web.

## Objetivo
Criar uma landing page simples e comercial com:
- PT-BR como idioma primario e EN como secundario
- Tema claro e tema escuro
- Hero com foto profissional
- Secoes de Tecnologias, Area de Atuacao e Contato
- Formulario de contato funcional em PHP
- Publicacao em ambiente HostGator

## Decisoes Fechadas
- Nome da marca na LP: Guilherme Hassã - Desenvolvedor Web
- Estilizacao: Tailwind CSS via npm local com build para producao
- Email comercial oficial: contato@hassa.dev.br
- Destino do formulario: contato@hassa.dev.br
- Hospedagem: HostGator com suporte PHP
- Logo: criar e usar SVG simples com letra H

## Estrutura Esperada
- index.html
- assets/css/input.css
- assets/css/app.css
- assets/js/content.js
- assets/js/main.js
- assets/icons/logo-h.svg
- contact.php

## Etapas de Execucao
1. Configurar Tailwind local e pipeline de build.
2. Construir estrutura da LP com layout responsivo.
3. Implementar conteudo bilíngue PT-BR/EN.
4. Implementar alternancia de tema com persistencia.
5. Criar logo SVG simples com letra H.
6. Implementar formulario com validacoes no front.
7. Implementar endpoint PHP para envio de email.
8. Validar funcionamento em desktop e mobile.
9. Publicar e testar envio real na HostGator.

## Formulario
Campos obrigatorios:
- Nome
- E-mail
- Telefone
- Assunto

Assuntos:
- Projeto sob medida
- Freelance sob demanda
- Contratacao para time

## Checklist de Qualidade
- Build CSS gerado sem uso de CDN em producao
- Tema claro/escuro funcionando e persistente
- PT-BR/EN funcionando e persistente
- Formulario validando e enviando corretamente
- Layout legivel e responsivo
- Acessibilidade basica: foco visivel, labels e contraste

## Entregabilidade de Email
Antes do go-live:
- Configurar SPF
- Configurar DKIM
- Configurar DMARC
