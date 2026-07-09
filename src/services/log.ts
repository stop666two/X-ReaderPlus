type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_PREFIX = '[X-ReaderPlus]'

function safeStringify(data: any): string {
  try {
    return JSON.stringify(data)
  } catch {
    try { return String(data) } catch { return '[unserializable]' }
  }
}

function formatMessage(level: LogLevel, message: string, data?: any): string {
  const timestamp = new Date().toISOString()
  const dataStr = data !== undefined ? ' ' + safeStringify(data) : ''
  return `${LOG_PREFIX} [${level.toUpperCase()}] ${timestamp} ${message}${dataStr}`
}

export const logger = {
  debug(message: string, data?: any) {
    console.debug(formatMessage('debug', message, data))
  },
  info(message: string, data?: any) {
    console.info(formatMessage('info', message, data))
  },
  warn(message: string, data?: any) {
    console.warn(formatMessage('warn', message, data))
  },
  error(message: string, data?: any) {
    console.error(formatMessage('error', message, data))
  }
}
