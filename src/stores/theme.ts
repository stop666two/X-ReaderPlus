import { defineStore } from 'pinia'
import { ref, reactive, watch } from 'vue'
import type { ThemeMode, CustomTheme } from '@/types'
import { db } from '@/services/db'
import { logger } from '@/services/log'
import { applyCustomThemeColors, resetVuetifyTheme } from '@/plugins/vuetify'
import { DEFAULT_CUSTOM_THEMES } from '@/constants'

const THEME_KEY = 'theme'
const CUSTOM_THEMES_KEY = 'customThemes'

export const useThemeStore = defineStore('theme', () => {
  const current = ref<ThemeMode>('light')
  const customThemes = reactive<Record<string, CustomTheme>>({ ...DEFAULT_CUSTOM_THEMES })

  async function load() {
    try {
      const record = await db.cfg.get(THEME_KEY)
      if (record && record.v) {
        const theme = record.v as ThemeMode
        if (['light', 'dark', 'sepia'].includes(theme)) {
          current.value = theme
        }
      }
      // Load custom theme overrides
      const ctRecord = await db.cfg.get(CUSTOM_THEMES_KEY)
      if (ctRecord?.v) {
        const saved: Record<string, CustomTheme> = JSON.parse(ctRecord.v)
        Object.assign(customThemes, saved)
      }
    } catch {
      // Defaults to light
    }
    // Apply custom overrides for all themes
    for (const [name, ct] of Object.entries(customThemes)) {
      applyCustomThemeColors(name, ct)
    }
  }

  async function setTheme(theme: ThemeMode) {
    current.value = theme
    try { await db.cfg.put({ k: THEME_KEY, v: theme }) } catch (e) { logger.error('保存主题设置失败', e) }
    applyTheme(theme)
  }

  function applyTheme(theme: ThemeMode) {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.className = `theme-${theme}`
  }

  function toggle() {
    const themes: ThemeMode[] = ['light', 'dark', 'sepia']
    const idx = themes.indexOf(current.value)
    const next = themes[(idx + 1) % themes.length]
    setTheme(next)
  }

  /** Save custom theme colors for a specific theme and apply to Vuetify */
  async function setCustomTheme(themeName: string, ct: CustomTheme) {
    customThemes[themeName] = { ...ct }
    await saveCustomThemes()
    applyCustomThemeColors(themeName, ct)
  }

  /** Reset a single theme back to its default colors */
  async function resetCustomTheme(themeName: string) {
    const defaults = DEFAULT_CUSTOM_THEMES[themeName]
    if (defaults) {
      customThemes[themeName] = { ...defaults }
    } else {
      delete customThemes[themeName]
    }
    await saveCustomThemes()
    resetVuetifyTheme(themeName)
  }

  /** Reset ALL custom themes to defaults */
  async function resetAllCustomThemes() {
    Object.assign(customThemes, JSON.parse(JSON.stringify(DEFAULT_CUSTOM_THEMES)))
    await saveCustomThemes()
    for (const [name] of Object.entries(DEFAULT_CUSTOM_THEMES)) {
      resetVuetifyTheme(name)
    }
  }

  async function saveCustomThemes() {
    const toSave: Record<string, CustomTheme> = {}
    // Only save if different from defaults
    for (const [name, ct] of Object.entries(customThemes)) {
      const def = DEFAULT_CUSTOM_THEMES[name]
      if (!def ||
          ct.primary !== def.primary ||
          ct.surface !== def.surface ||
          ct.background !== def.background ||
          ct.textColor !== def.textColor) {
        toSave[name] = ct
      }
    }
    if (Object.keys(toSave).length > 0) {
      try { await db.cfg.put({ k: CUSTOM_THEMES_KEY, v: JSON.stringify(toSave) }) } catch (e) { logger.error('保存自定义主题失败', e) }
    } else {
      // Remove the record if no customizations
      try { await db.cfg.delete(CUSTOM_THEMES_KEY) } catch (e) { logger.error('删除自定义主题配置失败', e) }
    }
    // Prune stale entries: any theme in saved data that no longer differs from defaults
    const savedRec = await db.cfg.get(CUSTOM_THEMES_KEY)
    if (savedRec?.v) {
      try {
        const saved: Record<string, CustomTheme> = JSON.parse(savedRec.v)
        let changed = false
        for (const name of Object.keys(saved)) {
          const ct = customThemes[name]
          const def = DEFAULT_CUSTOM_THEMES[name]
          if (ct && def &&
              ct.primary === def.primary &&
              ct.surface === def.surface &&
              ct.background === def.background &&
              ct.textColor === def.textColor) {
            delete saved[name]
            changed = true
          }
        }
        if (changed) {
          if (Object.keys(saved).length > 0) {
            await db.cfg.put({ k: CUSTOM_THEMES_KEY, v: JSON.stringify(saved) })
          } else {
            await db.cfg.delete(CUSTOM_THEMES_KEY)
          }
        }
      } catch { /* best-effort cleanup */ }
    }
  }

  watch(current, (theme) => {
    applyTheme(theme)
  }, { immediate: true })

  return {
    current,
    customThemes,
    load,
    setTheme,
    toggle,
    applyTheme,
    setCustomTheme,
    resetCustomTheme,
    resetAllCustomThemes
  }
})
