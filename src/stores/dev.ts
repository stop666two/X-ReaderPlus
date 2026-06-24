import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDevStore = defineStore('dev', () => {
  const isDev = ref(import.meta.env.DEV)
  const showDevTools = ref(false)

  function toggleDevTools() {
    showDevTools.value = !showDevTools.value
  }

  return { isDev, showDevTools, toggleDevTools }
})
