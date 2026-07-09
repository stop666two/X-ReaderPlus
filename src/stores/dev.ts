import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDevStore = defineStore('dev', () => {
  const isDev = ref(import.meta.env.DEV)
  const showDevTools = ref(false)

  function toggleDevTools() {
    showDevTools.value = !showDevTools.value
  }

  // In dev mode, expose for console inspection
  if (isDev.value) {
    ;(window as any).__xrpDev = { showDevTools, toggleDevTools }
  }

  return { isDev, showDevTools, toggleDevTools }
})
