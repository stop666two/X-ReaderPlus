import { generateSalt, hashPin, deriveKey, exportKey, importKey } from './crypto'
import { db } from './db'
import type { PinState, PinEscalation } from '@/types'
import { PIN_MAX_ATTEMPTS, PIN_LOCK_DURATION, DEFAULT_PIN_ESCALATION } from '@/constants'

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
  const raw = await db.cfg.get(PIN_STATE_KEY)
  if (raw && raw.v) {
    try {
      return JSON.parse(raw.v) as PinState
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

  await db.cfg.put({ k: PIN_STATE_KEY, v: JSON.stringify(state) })
  await db.cfg.put({ k: 'encryptionKey', v: exportedKey })
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
    await db.cfg.put({ k: PIN_STATE_KEY, v: JSON.stringify(state) })
    return true
  }

  state.failedAttempts++
  const esc = state.escalation || DEFAULT_PIN_ESCALATION
  if (state.failedAttempts >= esc.firstAttempts) {
    const alreadyLockedOnce = state.lockedUntil > 0
    if (alreadyLockedOnce && state.failedAttempts >= esc.firstAttempts + esc.secondAttempts) {
      state.lockedUntil = Date.now() + esc.secondLockDuration * 1000
    } else if (!alreadyLockedOnce) {
      state.lockedUntil = Date.now() + esc.firstLockDuration * 1000
    }
  }
  await db.cfg.put({ k: PIN_STATE_KEY, v: JSON.stringify(state) })
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
  const wasLocked = state.lockedUntil > 0
  // After first lockout, user gets firstAttempts + secondAttempts total before second lock
  const totalAllowed = wasLocked ? esc.firstAttempts + esc.secondAttempts : esc.firstAttempts
  return Math.max(0, totalAllowed - state.failedAttempts)
}

export async function clearPin(): Promise<void> {
  await db.cfg.delete(PIN_STATE_KEY)
  await db.cfg.delete('encryptionKey')
}

export async function saveEscalationSettings(escalation: PinEscalation): Promise<void> {
  const state = await getPinState()
  if (state && state.isSet) {
    state.escalation = escalation
    await db.cfg.put({ k: PIN_STATE_KEY, v: JSON.stringify(state) })
  }
  // Also save to a separate config so it persists even without PIN set
  await db.cfg.put({ k: 'pinEscalation', v: JSON.stringify(escalation) })
}

export async function getEscalationSettings(): Promise<PinEscalation> {
  const state = await getPinState()
  if (state?.escalation) return state.escalation
  const rec = await db.cfg.get('pinEscalation')
  if (rec?.v) {
    try { return JSON.parse(rec.v) as PinEscalation } catch { /* fall through */ }
  }
  return { ...DEFAULT_PIN_ESCALATION }
}

export async function getEncryptionKey(): Promise<CryptoKey | null> {
  const raw = await db.cfg.get('encryptionKey')
  if (!raw || !raw.v) return null
  try {
    return importKey(raw.v)
  } catch {
    return null
  }
}
