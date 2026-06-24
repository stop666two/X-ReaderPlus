import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { mdi } from 'vuetify/iconsets/mdi'

export const lightThemeColors = {
  dark: false,
  colors: {
    background: '#F5F5F5',
    surface: '#FFFFFF',
    'surface-variant': '#EEEEEE',
    primary: '#1565C0',
    secondary: '#546E7A',
    accent: '#1E88E5',
    error: '#D32F2F',
    info: '#1976D2',
    success: '#2E7D32',
    warning: '#F57C00',
    'on-background': '#212121',
    'on-surface': '#212121',
    'on-primary': '#FFFFFF',
    'on-secondary': '#FFFFFF',
    'border': '#E0E0E0',
    'reader-bg': '#FFFFFF',
    'reader-text': '#212121',
    'toolbar-bg': '#FFFFFF'
  }
}

export const darkThemeColors = {
  dark: true,
  colors: {
    background: '#121212',
    surface: '#1E1E1E',
    'surface-variant': '#2C2C2C',
    primary: '#90CAF9',
    secondary: '#B0BEC5',
    accent: '#64B5F6',
    error: '#EF5350',
    info: '#64B5F6',
    success: '#66BB6A',
    warning: '#FFB74D',
    'on-background': '#E0E0E0',
    'on-surface': '#E0E0E0',
    'on-primary': '#121212',
    'on-secondary': '#121212',
    'border': '#333333',
    'reader-bg': '#1E1E1E',
    'reader-text': '#E0E0E0',
    'toolbar-bg': '#1E1E1E'
  }
}

export const sepiaThemeColors = {
  dark: false,
  colors: {
    background: '#F4ECD8',
    surface: '#FDF6E3',
    'surface-variant': '#EFE8D8',
    primary: '#6D4C41',
    secondary: '#8D6E63',
    accent: '#A1887F',
    error: '#BF360C',
    info: '#5D4037',
    success: '#4E8C3E',
    warning: '#E6A817',
    'on-background': '#3E2723',
    'on-surface': '#3E2723',
    'on-primary': '#FFFFFF',
    'on-secondary': '#FFFFFF',
    'border': '#D7CCC8',
    'reader-bg': '#FDF6E3',
    'reader-text': '#3E2723',
    'toolbar-bg': '#FDF6E3'
  }
}

const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
    sets: { mdi }
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: lightThemeColors,
      dark: darkThemeColors,
      sepia: sepiaThemeColors
    }
  },
  defaults: {
    VBtn: {
      variant: 'tonal',
      rounded: 'lg'
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
      hideDetails: 'auto'
    },
    VSelect: {
      variant: 'outlined',
      density: 'comfortable',
      hideDetails: 'auto'
    },
    VCard: {
      variant: 'flat',
      rounded: 'lg'
    },
    VDialog: {
      maxWidth: 600
    },
    VTooltip: {
      openDelay: 300,
      closeDelay: 100
    }
  }
})

/**
 * Apply custom color overrides to a named Vuetify theme at runtime.
 * Call this whenever custom theme colors change.
 */
export function applyCustomThemeColors(themeName: string, custom: { primary?: string; surface?: string; background?: string; textColor?: string }) {
  const theme = vuetify.theme.themes.value[themeName]
  if (!theme) return
  if (custom.primary) theme.colors.primary = custom.primary
  if (custom.surface) {
    theme.colors.surface = custom.surface
    theme.colors['toolbar-bg'] = custom.surface
    theme.colors['reader-bg'] = custom.surface
  }
  if (custom.background) theme.colors.background = custom.background
  if (custom.textColor) {
    theme.colors['on-surface'] = custom.textColor
    theme.colors['on-background'] = custom.textColor
    theme.colors['reader-text'] = custom.textColor
  }
}

/**
 * Reset a named Vuetify theme back to its hardcoded defaults.
 */
export function resetVuetifyTheme(themeName: string) {
  const defaultsMap: Record<string, typeof lightThemeColors> = {
    light: lightThemeColors,
    dark: darkThemeColors,
    sepia: sepiaThemeColors
  }
  const defaults = defaultsMap[themeName]
  const theme = vuetify.theme.themes.value[themeName]
  if (!theme || !defaults) return
  Object.assign(theme.colors, JSON.parse(JSON.stringify(defaults.colors)))
}

export default vuetify
