import { ref, shallowRef, computed } from 'vue'

export interface ProgressOp {
  id: string
  label: string
  current: number
  total: number
  status: 'pending' | 'running' | 'done' | 'error'
  error?: string
  cancellable?: boolean
  cancel?: () => void
}

const globalOps = shallowRef<Map<string, ProgressOp>>(new Map())
const globalLoading = ref(false)
const globalMessage = ref('')

export function useAppProgress() {
  const isLoading = computed(() => globalLoading.value)
  const message = computed(() => globalMessage.value)
  const hasActiveOps = computed(() => {
    for (const op of globalOps.value.values()) {
      if (op.status === 'running') return true
    }
    return false
  })
  const activeCount = computed(() => {
    let n = 0
    for (const op of globalOps.value.values()) {
      if (op.status === 'running') n++
    }
    return n
  })

  function setLoading(v: boolean, msg?: string) {
    globalLoading.value = v
    if (msg !== undefined) globalMessage.value = msg
  }

  function setMessage(msg: string) {
    globalMessage.value = msg
  }

  return { isLoading, message, hasActiveOps, activeCount, setLoading, setMessage }
}

export function useOperation(label: string, opts?: { cancellable?: boolean }) {
  const id = `op_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const current = ref(0)
  const total = ref(0)
  const status = ref<ProgressOp['status']>('pending')
  const error = ref('')
  let _cancelFn: (() => void) | null = null

  const entry = computed((): ProgressOp => ({
    id, label, current: current.value, total: total.value,
    status: status.value, error: error.value,
    cancellable: opts?.cancellable,
    cancel: _cancelFn ?? undefined,
  }))

  function register() {
    const m = globalOps.value
    m.set(id, entry.value)
    globalOps.value = new Map(m)
    globalLoading.value = true
    globalMessage.value = label
  }

  function unregister() {
    const m = globalOps.value
    m.delete(id)
    globalOps.value = new Map(m)
    if (m.size === 0) {
      globalLoading.value = false
      globalMessage.value = ''
    }
  }

  function start(n: number) {
    status.value = 'running'
    total.value = n
    current.value = 0
    register()
  }

  function progress(val: number, msg?: string) {
    current.value = val
    if (msg) globalMessage.value = msg
    const m = globalOps.value
    m.set(id, { ...entry.value, current: val })
    globalOps.value = new Map(m)
  }

  function done(msg?: string) {
    status.value = 'done'
    if (msg) globalMessage.value = msg
    unregister()
  }

  function fail(err: string) {
    status.value = 'error'
    error.value = err
    globalMessage.value = err
    unregister()
  }

  function onCancel(fn: () => void) {
    _cancelFn = fn
  }

  return { id, current, total, status, error, start, progress, done, fail, onCancel }
}
