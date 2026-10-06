import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators:
    process.env.NEXT_PUBLIC_MOTORISTA_TEST_MODE === "true" ? false : undefined,
  distDir:
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_MOTORISTA_TEST_MODE === "true"
      ? ".next-motorista-qa"
      : ".next",
  reactCompiler: true,
  // Site estatico: `npm run build` gera `out/` com HTML/CSS/JS puros, servidos
  // direto pelo Caddy da VPS. Sem container, sem servidor Node em producao.
  // Desliga Server Actions, Route Handlers, ISR e middleware - o formulario de
  // contato posta num Cloudflare Worker (ver worker/).
  output: "export",
  // Sem servidor, nao ha quem otimize imagem em runtime.
  images: { unoptimized: true },
  // Mantem as URLs sem barra final; o Caddy resolve /rota -> /rota.html via
  // try_files (ver bloco do Caddyfile no README).
  trailingSlash: false,
};

export default nextConfig;
