// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    files: ['e2e/**/*.js', 'eslint.config.js'],
    languageOptions: { globals: { require: 'readonly', module: 'writable', __dirname: 'readonly', process: 'readonly', console: 'readonly' } },
  },
  {
    ignores: ['dist/*', 'node_modules/*', 'android/*', 'ios/*', 'test/fixtures/*'],
  },
]);
