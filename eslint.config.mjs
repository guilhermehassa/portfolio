import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Legacy PHP/static site kept for reference during the Next.js migration.
    "old/**",
    // Cloudflare Worker: projeto separado, runtime nao-DOM, lint e tsconfig proprios.
    "worker/**",
  ]),
]);

export default eslintConfig;
