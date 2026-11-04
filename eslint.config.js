import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import astro from 'eslint-plugin-astro';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/', '**/.astro/', '**/node_modules/', '**/public/vendor/', 'target/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  ...astro.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // PRD: tidak ada innerHTML dari input pengguna.
      'vue/no-v-html': 'error',
      'vue/multi-word-component-names': 'off',
    },
  },
  // Format diurus Prettier; matikan aturan ESLint yang bentrok.
  prettier,
);
