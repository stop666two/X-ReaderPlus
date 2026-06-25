import { createI18n } from 'vue-i18n'
import { zhCN, enUS } from '@/locales'

const i18n = createI18n({
  legacy: false, // Use Composition API mode
  locale: 'zh-CN',
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
})

export default i18n
