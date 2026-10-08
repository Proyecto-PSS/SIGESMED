import nextPlugin from '@next/eslint-plugin-next'

const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**', '.data/**', 'scripts/**'],
  },
  {
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
]

export default eslintConfig
