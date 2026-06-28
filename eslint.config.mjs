import js from '@eslint/js'
import ts from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['src/**/*.{ts,vue}'],
    languageOptions: {
      parserOptions: { parser: ts.parser },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        FileReader: 'readonly',
        File: 'readonly',
        FormData: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        crypto: 'readonly',
        requestAnimationFrame: 'readonly',
        IntersectionObserver: 'readonly',
        NodeFilter: 'readonly',
        Text: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLParagraphElement: 'readonly',
        HTMLStyleElement: 'readonly',
        HTMLImageElement: 'readonly',
        Event: 'readonly',
        KeyboardEvent: 'readonly',
        DragEvent: 'readonly',
        MouseEvent: 'readonly',
        WheelEvent: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-control-regex': 'off',
      'no-case-declarations': 'off',
      '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true }],
      'vue/no-side-effects-in-computed-properties': 'off',
      'vue/multi-word-component-names': 'off'
    }
  },
  { ignores: ['dist/', 'backend/', 'node_modules/', 'src/services/parse-worker.ts'] }
]
