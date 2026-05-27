import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
// DS §3 Fase 3 — plugin local que proíbe cores hex/rgb hardcoded em JSX
import dsTokens from "eslint-plugin-ds-tokens";

export default tseslint.config(
  { ignores: ["dist", "eslint-plugin-ds-tokens"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      // DS §3 Fase 3 — proibir cores hardcoded fora de tokens semânticos
      "ds-tokens": dsTokens,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      // DS §3 Fase 3 — proibir hex hardcoded em className e style inline
      "ds-tokens/no-hardcoded-colors": "warn",
    },
  },
);
