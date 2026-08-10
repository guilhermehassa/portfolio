/**
 * Endpoint do formulario de contato de hassa.dev.br.
 *
 * O site e um export estatico servido pelo Caddy na VPS, entao nao existe
 * backend proprio para receber o POST. Este Worker faz esse papel: valida o
 * payload e repassa para a API HTTP do Brevo.
 *
 * Por que API HTTP e nao SMTP: Workers nao abrem conexao TCP/SMTP, entao o
 * nodemailer usado no Agendarium nao tem equivalente aqui.
 */

interface Env {
  BREVO_API_KEY: string;
  ALLOWED_ORIGIN: string;
  CONTACT_TO: string;
  CONTACT_FROM: string;
  CONTACT_FROM_NAME: string;
  /** Presente so quando o binding de rate limit esta ativo no wrangler.toml. */
  RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

interface ContactPayload {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  subject?: unknown;
  subjectLabel?: unknown;
  locale?: unknown;
  website?: unknown;
}

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

/** Espelha as chaves de `subjectOptions` em lib/content.ts. */
const VALID_SUBJECTS = new Set(["custom-project", "freelance", "hiring"]);

const MAX_FIELD_LENGTH = 200;

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_FIELD_LENGTH) : "";
}

/** Escapa o que o visitante digitou antes de interpolar no corpo HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowedOrigin = env.ALLOWED_ORIGIN;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
    }

    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, allowedOrigin);
    }

    // A checagem de CORS do navegador ja barra outra origem, mas ela nao vale
    // para requisicao fora do navegador; por isso conferimos no servidor.
    const origin = request.headers.get("Origin");
    if (origin && origin !== allowedOrigin) {
      return json({ error: "forbidden_origin" }, 403, allowedOrigin);
    }

    if (env.RATE_LIMITER) {
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) {
        return json({ error: "rate_limited" }, 429, allowedOrigin);
      }
    }

    let payload: ContactPayload;
    try {
      payload = (await request.json()) as ContactPayload;
    } catch {
      return json({ error: "invalid_json" }, 400, allowedOrigin);
    }

    // Honeypot: campo invisivel no formulario. Se veio preenchido, e bot.
    // Responde 200 de proposito - erro so ensinaria o bot a contornar.
    if (asText(payload.website)) {
      return json({ ok: true }, 200, allowedOrigin);
    }

    const name = asText(payload.name);
    const email = asText(payload.email);
    const phone = asText(payload.phone);
    const subject = asText(payload.subject);
    const subjectLabel = asText(payload.subjectLabel) || subject;
    const locale = asText(payload.locale) || "pt-BR";

    // Revalida tudo: a validacao do cliente e conveniencia de UX, nao barreira.
    const errors: string[] = [];
    if (name.length < 3) errors.push("name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("email");
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) errors.push("phone");
    if (!VALID_SUBJECTS.has(subject)) errors.push("subject");

    if (errors.length > 0) {
      return json({ error: "validation_failed", fields: errors }, 400, allowedOrigin);
    }

    const rows: Array<[string, string]> = [
      ["Nome", name],
      ["E-mail", email],
      ["Telefone", phone],
      ["Assunto", subjectLabel],
      ["Idioma", locale],
    ];

    const htmlContent = `<h2>Novo contato pelo hassa.dev.br</h2><table cellpadding="6" style="border-collapse:collapse">${rows
      .map(
        ([label, value]) =>
          `<tr><td style="border:1px solid #ddd"><strong>${label}</strong></td><td style="border:1px solid #ddd">${escapeHtml(value)}</td></tr>`,
      )
      .join("")}</table>`;

    const textContent = rows.map(([label, value]) => `${label}: ${value}`).join("\n");

    const brevoResponse = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        // Remetente e do dominio autenticado por DKIM; o e-mail do visitante
        // vai no replyTo. Usar o endereco dele como remetente quebraria a
        // autenticacao e mandaria a mensagem para spam.
        sender: { name: env.CONTACT_FROM_NAME, email: env.CONTACT_FROM },
        to: [{ email: env.CONTACT_TO }],
        replyTo: { email, name },
        subject: `[Portfolio] ${subjectLabel} - ${name}`,
        htmlContent,
        textContent,
      }),
    });

    if (!brevoResponse.ok) {
      // O corpo do erro do Brevo pode conter dado da requisicao; fica so no log.
      console.error("brevo_error", brevoResponse.status, await brevoResponse.text());
      return json({ error: "send_failed" }, 502, allowedOrigin);
    }

    return json({ ok: true }, 200, allowedOrigin);
  },
};
