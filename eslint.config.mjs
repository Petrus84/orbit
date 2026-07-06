import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  // 🛡️ TRAVA 1: Isola o lixo de cache, builds e bibliotecas antes de rodar o linter
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "**/.turbo/**",
    "next-env.d.ts",
  ]),

  // Aplica as validações estritamente sobre o código limpo que sobrou
  ...nextVitals,
  ...nextTs,
]);

export default eslintConfig;
