const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const prettier = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');
const importPlugin = require('eslint-plugin-import');

module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', 'front/**'],
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'commonjs',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      prettier,
      import: importPlugin,
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      'import/extensions': 'off',
    },
  },
];
