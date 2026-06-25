import { defineStore } from 'pinia'
import { ref, reactive, watch } from 'vue'
import type { ThemeMode, CustomTheme } from '@/types'
import { logger } from '@/services/log'
import { applyCustomThemeColors, resetVuetifyTheme } from '@/plugins/vuetify'
import { DEFAULT_CUSTOM_THEMES } from '@/constants'

const THEME_KEY = 'theme'
const CUSTOM_THEMES_KEY = 'customThemes'

export const useThemeStore = defineStore('theme', () => {
  const current = ref<ThemeMode>('light')
  const customThemes = reactive<Record<string, CustomTheme>>({ ...DEFAULT_CUSTOM_THEMES })

  async function load() {
    if (!window.electronAPI) return
    try {
      const t = await window.electronAPI.config.get(THEME_KEY)
      if (t) {
        const theme = t as ThemeMode
        if (['light', 'dark', 'sepia'].includes(theme)) {
          current.value = theme
        }
      }
      // Load custom theme overrides
      const ctValue = await window.electronAPI.config.get(CUSTOM_THEMES_KEY)
      if (ctValue) {
        const saved: Record<string, CustomTheme> = JSON.parse(ctValue)
        Object.assign(customThemes, saved)
      }
    } catch {
      // Defaults to light
    }
    // Apply custom overrides for all themes
    for (const [name, ct] of Object.entries(customThemes)) {
      applyCustomThemeColors(name, ct)
    }
    // Apply the loaded (or default) theme after load completes
    applyTheme(current.value)
  }

  async function setTheme(theme: ThemeMode) {
    current.value = theme
    if (window.electronAPI) {
      try { await window.electronAPI.config.set(THEME_KEY, theme) } catch (e) { logger.error('保存主题设置失败', e) }
    }
    // applyTheme is called by the watcher on current, so we don't call it here
  }

  function applyTheme(theme: ThemeMode) {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.className = `theme-${theme}`

    // Inject CSS custom properties for reader area
    // Components use var(--reader-*) instead of checking theme directly
    const root = document.documentElement.style
    switch (theme) {
      case 'dark':
        root.setProperty('--reader-bg', '#1E1E1E')
        root.setProperty('--reader-text', '#E0E0E0')
        root.setProperty('--reader-accent', '#90CAF9')
        root.setProperty('--reader-border', '#333333')
        break
      case 'sepia':
        root.setProperty('--reader-bg', '#FDF6E3')
        root.setProperty('--reader-text', '#3E2723')
        root.setProperty('--reader-accent', '#6D4C41')
        root.setProperty('--reader-border', '#D7CCC8')
        break
      default: // light
        root.setProperty('--reader-bg', '#FFFFFF')
        root.setProperty('--reader-text', '#212121')
        root.setProperty('--reader-accent', '#1565C0')
        root.setProperty('--reader-border', '#E0E0E0')
    }
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
    if (!window.electronAPI) return
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
      try { await window.electronAPI.config.set(CUSTOM_THEMES_KEY, JSON.stringify(toSave)) } catch (e) { logger.error('保存自定义主题失败', e) }
    } else {
      // Remove the record if no customizations
      try { await window.electronAPI.config.delete(CUSTOM_THEMES_KEY) } catch (e) { logger.error('删除自定义主题配置失败', e) }
    }
    // Prune stale entries: any theme in saved data that no longer differs from defaults
    const savedValue = await window.electronAPI.config.get(CUSTOM_THEMES_KEY)
    if (savedValue) {
      try {
        const saved: Record<string, CustomTheme> = JSON.parse(savedValue)
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
            await window.electronAPI.config.set(CUSTOM_THEMES_KEY, JSON.stringify(saved))
          } else {
            await window.electronAPI.config.delete(CUSTOM_THEMES_KEY)
          }
        }
      } catch { /* best-effort cleanup */ }
    }
  }

  watch(current, (theme) => {
    applyTheme(theme)
  })

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
