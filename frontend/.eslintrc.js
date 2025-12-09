module.exports = {
   root: true,
   env: { browser: true, es2020: true },
   extends: [
      'eslint:recommended',
      '@typescript-eslint/recommended',
      'plugin:react-hooks/recommended',
      'plugin:react/recommended',
      'plugin:react/jsx-runtime',
      'plugin:security/recommended',
   ],
   ignorePatterns: ['dist', '.eslintrc.cjs'],
   parser: '@typescript-eslint/parser',
   plugins: ['react-refresh', 'security', '@typescript-eslint'],
   rules: {
      'react-refresh/only-export-components': [
         'warn',
         { allowConstantExport: true },
      ],
      // Règles de sécurité
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-require': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error',

      // Règles TypeScript
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Règles React
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-undef': 'error',
      'react/jsx-pascal-case': 'error',
      'react/jsx-sort-props': 'off',
      'react/jsx-wrap-multilines': 'error',

      // Règles générales
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'template-curly-spacing': 'error',
      'arrow-spacing': 'error',
      'no-duplicate-imports': 'error',
      'no-useless-constructor': 'error',
      'no-useless-rename': 'error',
      'prefer-destructuring': 'warn',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
   },
   settings: {
      react: {
         version: 'detect',
      },
   },
   overrides: [
      {
         files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
         env: {
            jest: true,
         },
         rules: {
            'no-console': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
         },
      },
   ],
}; 