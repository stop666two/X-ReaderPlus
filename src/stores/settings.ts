import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import type { AppSettings, ReadingSettings, ThemeColors, ReadingShortcuts } from '@/types'
import { logger } from '@/services/log'
import {
  DEFAULT_READING_SETTINGS,
  DEFAULT_TOOLBAR_AUTO_HIDE_DELAY,
  DEFAULT_AUTO_SCROLL_SPEED,
  DEFAULT_THEME_COLORS,
  DEFAULT_READING_SHORTCUTS
} from '@/constants'

const SETTINGS_KEY = 'appSettings'

export const useSettingsStore = defineStore('settings', () => {
  const readingSettings = reactive<ReadingSettings>({ ...DEFAULT_READING_SETTINGS })
  const toolbarAutoHideDelay = ref(DEFAULT_TOOLBAR_AUTO_HIDE_DELAY)
  const autoScrollSpeed = ref(DEFAULT_AUTO_SCROLL_SPEED)
  const themeColors = reactive<ThemeColors>({ ...DEFAULT_THEME_COLORS })
  const readingShortcuts = reactive<ReadingShortcuts>({ ...DEFAULT_READING_SHORTCUTS })
  const loaded = ref(false)

  async function load() {
    if (!window.electronAPI) return
    try {
      const value = await window.electronAPI.config.get(SETTINGS_KEY)
      if (value) {
        const settings: AppSettings = JSON.parse(value)
        Object.assign(readingSettings, settings.readingSettings || {})
        toolbarAutoHideDelay.value = settings.toolbarAutoHideDelay ?? DEFAULT_TOOLBAR_AUTO_HIDE_DELAY
        autoScrollSpeed.value = settings.autoScrollSpeed ?? DEFAULT_AUTO_SCROLL_SPEED
        if (settings.themeColors) {
          Object.assign(themeColors, settings.themeColors)
        }
        if (settings.readingShortcuts) {
          Object.assign(readingShortcuts, settings.readingShortcuts)
        }
      }
    } catch {
      // Use defaults
    }
    loaded.value = true
  }

  async function save() {
    if (!window.electronAPI) return
    try {
      const settings: AppSettings = {
        readingSettings: { ...readingSettings },
        toolbarAutoHideDelay: toolbarAutoHideDelay.value,
        autoScrollSpeed: autoScrollSpeed.value,
        themeColors: { ...themeColors },
        readingShortcuts: { ...readingShortcuts }
      }
      await window.electronAPI.config.set(SETTINGS_KEY, JSON.stringify(settings))
    } catch (e) {
      logger.error('保存设置失败', e)
    }
  }

  async function updateReadingSetting<K extends keyof ReadingSettings>(key: K, value: ReadingSettings[K]) {
    readingSettings[key] = value
    await save()
  }

  async function setToolbarAutoHideDelay(delay: number) {
    toolbarAutoHideDelay.value = delay
    await save()
  }

  async function setAutoScrollSpeed(speed: number) {
    autoScrollSpeed.value = speed
    await save()
  }

  async function setThemeColor<K extends keyof ThemeColors>(key: K, value: string) {
    themeColors[key] = value
    await save()
  }

  async function setAllThemeColors(colors: ThemeColors) {
    Object.assign(themeColors, colors)
    await save()
  }

  async function resetReadingSettings() {
    Object.assign(readingSettings, DEFAULT_READING_SETTINGS)
    toolbarAutoHideDelay.value = DEFAULT_TOOLBAR_AUTO_HIDE_DELAY
    autoScrollSpeed.value = DEFAULT_AUTO_SCROLL_SPEED
    Object.assign(readingShortcuts, DEFAULT_READING_SHORTCUTS)
    await save()
  }

  async function resetReadingShortcuts() {
    Object.assign(readingShortcuts, DEFAULT_READING_SHORTCUTS)
    await save()
  }

  async function resetThemeColors() {
    Object.assign(themeColors, DEFAULT_THEME_COLORS)
    await save()
  }

  return {
    readingSettings,
    toolbarAutoHideDelay,
    autoScrollSpeed,
    themeColors,
    readingShortcuts,
    loaded,
    load,
    save,
    updateReadingSetting,
    setToolbarAutoHideDelay,
    setAutoScrollSpeed,
    setThemeColor,
    setAllThemeColors,
    resetReadingSettings,
    resetReadingShortcuts,
    resetThemeColors
  }
})
