import { generateSalt, hashPin, deriveKey, exportKey, importKey } from './crypto'
import type { PinState, PinEscalation } from '@/types'
import { PIN_MAX_ATTEMPTS, PIN_LOCK_DURATION, DEFAULT_PIN_ESCALATION } from '@/constants'

// Config helpers — uses electronAPI in Electron, localStorage fallback in browser dev mode
function configGet(key: string): Promise<string | null> {
  if (typeof window !== 'undefined' && window.electronAPI?.config) {
    return window.electronAPI.config.get(key).then((v: string | undefined | null) => v ?? null)
  }
  return Promise.resolve(localStorage.getItem(key))
}

function configSet(key: string, value: string): Promise<void> {
  if (typeof window !== 'undefined' && window.electronAPI?.config) {
    return window.electronAPI.config.set(key, value)
  }
  localStorage.setItem(key, value)
  return Promise.resolve()
}

function configDelete(key: string): Promise<void> {
  if (typeof window !== 'undefined' && window.electronAPI?.config) {
    return window.electronAPI.config.delete(key)
  }
  localStorage.removeItem(key)
  return Promise.resolve()
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

const PIN_STATE_KEY = 'pinState'

export async function getPinState(): Promise<PinState | null> {
  const raw = await configGet(PIN_STATE_KEY)
  if (raw) {
    try {
      return JSON.parse(raw) as PinState
    } catch {
      return null
    }
  }
  return null
}

export async function setPin(pin: string): Promise<void> {
  const salt = generateSalt()
  const hash = await hashPin(pin, salt)
  const key = await deriveKey(pin, salt)
  const exportedKey = await exportKey(key)

  const state: PinState = {
    isSet: true,
    hash,
    salt: btoa(String.fromCharCode(...salt)),
    lockedUntil: 0,
    failedAttempts: 0,
    escalation: { ...DEFAULT_PIN_ESCALATION }
  }

  await configSet(PIN_STATE_KEY, JSON.stringify(state))
  await configSet('encryptionKey', exportedKey)
}

export async function verifyPin(pin: string): Promise<boolean> {
  const state = await getPinState()
  if (!state || !state.isSet) return true

  if (state.lockedUntil > Date.now()) {
    return false
  }

  const salt = new Uint8Array(
    atob(state.salt).split('').map(c => c.charCodeAt(0))
  )
  const hash = await hashPin(pin, salt)

  if (timingSafeEqual(hash, state.hash)) {
    state.failedAttempts = 0
    state.lockedUntil = 0
    await configSet(PIN_STATE_KEY, JSON.stringify(state))
    return true
  }

  state.failedAttempts++
  const esc = state.escalation || DEFAULT_PIN_ESCALATION
  if (state.failedAttempts >= esc.firstAttempts) {
    const isCurrentlyLocked = state.lockedUntil > Date.now()
    const wasEverLocked = state.lockedUntil > 0
    if (isCurrentlyLocked && state.failedAttempts >= esc.firstAttempts + esc.secondAttempts) {
      // Extend lock under second tier
      state.lockedUntil = Date.now() + esc.secondLockDuration * 1000
    } else if (wasEverLocked && state.failedAttempts >= esc.firstAttempts + esc.secondAttempts) {
      // Lock expired but we're past combined threshold — second-tier lock
      state.lockedUntil = Date.now() + esc.secondLockDuration * 1000
    } else if (!wasEverLocked) {
      // First lock
      state.lockedUntil = Date.now() + esc.firstLockDuration * 1000
    } else {
      // Lock previously expired — re-lock with first tier duration
      state.lockedUntil = Date.now() + esc.firstLockDuration * 1000
    }
  }
  await configSet(PIN_STATE_KEY, JSON.stringify(state))
  return false
}

export async function isPinRequired(): Promise<boolean> {
  const state = await getPinState()
  return state?.isSet ?? false
}

export async function getLockRemaining(): Promise<number> {
  const state = await getPinState()
  if (!state || !state.isSet) return 0
  if (state.lockedUntil > Date.now()) {
    return state.lockedUntil - Date.now()
  }
  return 0
}

export async function getRemainingAttempts(): Promise<number> {
  const state = await getPinState()
  if (!state || !state.isSet) return (state?.escalation || DEFAULT_PIN_ESCALATION).firstAttempts
  const esc = state.escalation || DEFAULT_PIN_ESCALATION

  // If currently locked, no attempts remain
  if (state.lockedUntil > Date.now()) return 0

  // Lock expired or never locked — calculate remaining before next lock
  const wasEverLocked = state.lockedUntil > 0
  const totalAllowed = wasEverLocked ? esc.firstAttempts + esc.secondAttempts : esc.firstAttempts
  return Math.max(0, totalAllowed - state.failedAttempts)
}

export async function clearPin(): Promise<void> {
  await configDelete(PIN_STATE_KEY)
  await configDelete('encryptionKey')
}

export async function saveEscalationSettings(escalation: PinEscalation): Promise<void> {
  const state = await getPinState()
  if (state && state.isSet) {
    state.escalation = escalation
    await configSet(PIN_STATE_KEY, JSON.stringify(state))
  }
  // Also save to a separate config so it persists even without PIN set
  await configSet('pinEscalation', JSON.stringify(escalation))
}

export async function getEscalationSettings(): Promise<PinEscalation> {
  const state = await getPinState()
  if (state?.escalation) return state.escalation
  const rec = await configGet('pinEscalation')
  if (rec) {
    try { return JSON.parse(rec) as PinEscalation } catch { /* fall through */ }
  }
  return { ...DEFAULT_PIN_ESCALATION }
}

export async function getEncryptionKey(): Promise<CryptoKey | null> {
  const raw = await configGet('encryptionKey')
  if (!raw) return null
  try {
    return importKey(raw)
  } catch {
    return null
  }
}
