// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    files: ['tests/e2e/**/*.js', 'eslint.config.js'],
    languageOptions: {
      globals: { require: 'readonly', module: 'writable', __dirname: 'readonly', process: 'readonly', console: 'readonly' },
    },
  },
  // Layering: domain is pure TypeScript; features never import each other.
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-native', 'expo-*', '**/services/**', '**/features/**', '**/shared/**'],
              message: 'src/domain must stay pure TypeScript.',
            },
          ],
        },
      ],
    },
  },
  ...['home', 'find-garden', 'garden-3d'].map((feature) => ({
    files: [`src/features/${feature}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: `(^|/)(${['home', 'find-garden', 'garden-3d'].filter((f) => f !== feature).join('|')})/`,
              message: 'Features must not import each other; move shared code to src/shared or src/domain.',
            },
          ],
        },
      ],
    },
  })),
  {
    ignores: ['dist/*', 'node_modules/*', 'android/*', 'ios/*', 'tests/fixtures/*', 'tests/e2e/output/*'],
  },
]);
