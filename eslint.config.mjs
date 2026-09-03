import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import zodPlugin from "eslint-plugin-zod";

const eslintConfig = [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/out/**",
      "**/build/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/prisma/generated-client/**",
      "next-env.d.ts",
      "examples/**",
      "skills/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    plugins: {
      react: reactPlugin,
      zod: zodPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/prefer-as-const": "off",

      "prefer-const": "off",
      "no-unused-vars": "off",
      "no-console": "off",
      "no-debugger": "off",
      "no-empty": "off",
      "no-irregular-whitespace": "off",
      "no-case-declarations": "off",
      "no-fallthrough": "off",
      "no-mixed-spaces-and-tabs": "off",
      "no-redeclare": "off",
      "no-undef": "off",
      "no-unreachable": "off",
      "no-unexpected-multiline": "off",
      "no-useless-escape": "off",
      "no-useless-assignment": "off",
      "preserve-caught-error": "off",

      // Design tokens: prefer the theme tokens (bg-muted, text-muted-foreground,
      // border-border, bg-card, text-foreground …) over hardcoded Tailwind grey
      // ramps, which don't track light/dark and drift the palette. Warn-only so
      // it flags new code without blocking on the existing backlog.
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "Literal[value=/\\b(?:bg|text|border|ring|divide|from|to|via|placeholder|caret|accent|decoration|outline|shadow|fill|stroke)-(?:zinc|slate|gray|neutral|stone)-(?:50|100|200|300|400|500|600|700|800|900|950)\\b/]",
          message:
            "Use a theme token (bg-muted, text-muted-foreground, border-border, bg-card, text-foreground …) instead of a hardcoded zinc/slate/gray/neutral/stone shade — hardcoded ramps don't respond to dark mode.",
        },
        {
          selector:
            "TemplateElement[value.raw=/\\b(?:bg|text|border|ring|divide|from|to|via|placeholder|caret|accent|decoration|outline|shadow|fill|stroke)-(?:zinc|slate|gray|neutral|stone)-(?:50|100|200|300|400|500|600|700|800|900|950)\\b/]",
          message:
            "Use a theme token instead of a hardcoded zinc/slate/gray/neutral/stone shade — hardcoded ramps don't respond to dark mode.",
        },
      ],
    },
  },
];

export default eslintConfig;
