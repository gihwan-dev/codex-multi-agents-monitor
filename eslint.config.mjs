import tsParser from "@typescript-eslint/parser";

const sharedIgnores = [
  "dist/**",
  "storybook-static/**",
  ".tmp-tests/**",
  ".tmp-quality/**",
  "node_modules/**",
  "scripts/**",
  "tests/**",
  "src/app/styles/index.css",
  "src/entities/run/model/samples.ts",
  "src-tauri/src/test_support.rs",
  "**/*.stories.*",
  "**/*.story.*",
  "**/__snapshots__/**",
  "**/__fixtures__/**",
  "**/generated/**",
  "**/*.d.ts",
];

export default [
  {
    ignores: sharedIgnores,
  },
  {
    files: ["**/*.{ts,tsx,mjs}"],
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      complexity: ["error", 7],
      "max-depth": ["error", 3],
      "max-statements": ["error", 8],
    },
  },
];
