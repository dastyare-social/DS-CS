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
    // Generated/third-party type declarations are not ours to lint.
    "src/types/**",
  ]),
  // Prefer style over strictness in test files.
  {
    files: ["**/__tests__/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Experimental react-hooks v6 rules are noisy upgrades of stable rules:
  // downgrade to warnings so they surface without blocking the build.
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // Ignore underscore-prefixed function args (e.g. proxy(_request)) so
      // intentionally-unused handler signatures stay warning-free.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;
