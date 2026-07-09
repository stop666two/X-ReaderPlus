import { ref, computed, onUnmounted } from 'vue'

type PomodoroState = 'idle' | 'focus' | 'break' | 'paused'

export function usePomodoro(defaultFocusMinutes = 25, defaultBreakMinutes = 5) {
  const state = ref<PomodoroState>('idle')
  const focusMinutes = ref(defaultFocusMinutes)
  const breakMinutes = ref(defaultBreakMinutes)
  const remainingSeconds = ref(0)
  const cycles = ref(0)

  let timer: ReturnType<typeof setInterval> | null = null

  function tick() {
    if (remainingSeconds.value > 0) {
      remainingSeconds.value--
    } else {
      if (state.value === 'focus') {
        state.value = 'break'
        remainingSeconds.value = breakMinutes.value * 60
        cycles.value++
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('X-ReaderPlus', { body: `专注完成！休息 ${breakMinutes.value} 分钟吧` })
        }
      } else if (state.value === 'break') {
        state.value = 'focus'
        remainingSeconds.value = focusMinutes.value * 60
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('X-ReaderPlus', { body: '休息结束，继续阅读！' })
        }
      }
    }
  }

  function start() {
    if (Notification.permission === 'default') Notification.requestPermission()
    if (state.value === 'paused') {
      state.value = 'focus'
    } else {
      state.value = 'focus'
      remainingSeconds.value = focusMinutes.value * 60
      cycles.value = 0
    }
    if (timer) clearInterval(timer)
    timer = setInterval(tick, 1000)
  }

  function pause() {
    if (state.value === 'focus' || state.value === 'break') {
      state.value = 'paused'
      if (timer) { clearInterval(timer); timer = null }
    }
  }

  function reset() {
    if (timer) clearInterval(timer)
    timer = null
    state.value = 'idle'
    remainingSeconds.value = 0
  }

  function skip() {
    remainingSeconds.value = 0
    tick()
  }

  const displayTime = computed(() => {
    const m = Math.floor(remainingSeconds.value / 60)
    const s = remainingSeconds.value % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  })

  const progress = computed(() => {
    const total = state.value === 'focus' ? focusMinutes.value * 60 : state.value === 'break' ? breakMinutes.value * 60 : 1
    return (total - remainingSeconds.value) / total
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  return { state, displayTime, progress, cycles, focusMinutes, breakMinutes, start, pause, reset, skip }
}
