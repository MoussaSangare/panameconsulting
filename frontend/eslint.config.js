import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";

/**
 * ESLint Flat Config pour React + TypeScript
 */
export default [
  js.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],

    plugins: {
      react: reactPlugin,
      "@typescript-eslint": tsPlugin
    },

    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true
        },
        project: "./tsconfig.json"
      }
    },

    settings: {
      react: {
        version: "detect"
      }
    },

    rules: {
      "react/react-in-jsx-scope": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn"]
    }
  }
];