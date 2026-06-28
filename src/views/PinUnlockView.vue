<template>
  <v-container class="fill-height flex-center" fluid>
    <v-card max-width="400" class="mx-auto pa-6" elevation="0">
      <v-card-title class="text-center text-h5 mb-4">
        <v-icon size="48" class="mb-2" color="primary">mdi-shield-lock</v-icon>
        <div>X-ReaderPlus</div>
      </v-card-title>

      <v-card-text>
        <div v-if="isLocked" class="text-center mb-4">
          <v-icon size="64" color="error">mdi-timer-sand</v-icon>
          <p class="text-h6 mt-2 text-error">已锁定</p>
          <p class="text-body-2 text-medium-emphasis">
            密码错误次数过多，请等待 {{ lockSeconds }} 秒后重试
          </p>
        </div>

        <div v-else>
          <p class="text-center text-body-2 text-medium-emphasis mb-4">
            请输入 PIN 码解锁应用
          </p>

          <v-text-field
            v-model="pin"
            :type="showPin ? 'text' : 'password'"
            label="PIN 码"
            placeholder="输入您的 PIN 码"
            variant="outlined"
            :error="error"
            :error-messages="error ? errorMessage : ''"
            :append-inner-icon="showPin ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showPin = !showPin"
            @keyup.enter="unlock"
            autofocus
            maxlength="32"
          />

          <v-btn
            block
            color="primary"
            size="large"
            class="mt-2"
            @click="unlock"
            :loading="loading"
          >
            解锁
          </v-btn>

          <p class="text-caption text-center mt-2 text-medium-emphasis">
            剩余尝试次数: {{ remainingAttempts }}
          </p>
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { verifyPin, getLockRemaining, getRemainingAttempts } from '@/services/pin'
import { resetPinCheck } from '@/router'

const router = useRouter()
const route = useRoute()

const pin = ref('')
const showPin = ref(false)
const error = ref(false)
const errorMessage = ref('')
const loading = ref(false)
const isLocked = ref(false)
const lockSeconds = ref(0)
const remainingAttempts = ref(5)

let lockTimer: ReturnType<typeof setInterval> | null = null

async function checkLockStatus() {
  const remaining = await getLockRemaining()
  if (remaining > 0) {
    isLocked.value = true
    lockSeconds.value = Math.ceil(remaining / 1000)
    startLockCountdown(remaining)
  } else {
    isLocked.value = false
    const attempts = await getRemainingAttempts()
    remainingAttempts.value = attempts
  }
}

function startLockCountdown(remainingMs: number) {
  if (lockTimer) clearInterval(lockTimer)
  lockTimer = setInterval(() => {
    lockSeconds.value--
    if (lockSeconds.value <= 0) {
      if (lockTimer) clearInterval(lockTimer)
      isLocked.value = false
      checkLockStatus()
    }
  }, 1000)
}

async function unlock() {
  if (!pin.value.trim()) {
    error.value = true
    errorMessage.value = '请输入 PIN 码'
    return
  }

  loading.value = true
  error.value = false

  try {
    const valid = await verifyPin(pin.value)
    if (valid) {
      resetPinCheck()
      router.replace({ name: 'bookshelf' })
    } else {
      pin.value = ''
      error.value = true
      const locked = await getLockRemaining()
      if (locked > 0) {
        isLocked.value = true
        lockSeconds.value = Math.ceil(locked / 1000)
        startLockCountdown(locked)
      } else {
        errorMessage.value = 'PIN 码错误'
        remainingAttempts.value = await getRemainingAttempts()
      }
    }
  } catch (e: any) {
    error.value = true
    errorMessage.value = e.message || '验证失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  checkLockStatus()
})

onUnmounted(() => {
  if (lockTimer) clearInterval(lockTimer)
})
</script>
