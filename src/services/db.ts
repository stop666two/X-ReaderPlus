import { logger } from './log'

const withBridge = () => typeof window !== 'undefined' && !!window.electronAPI

function createTableStub(name: string) {
  const warn = () => {
    if (!withBridge()) {
      logger.warn(`db.${name}: IndexedDB fallback unavailable; all data operations go through Go API bridge`)
    }
  }
  return {
    async toArray(): Promise<any[]> { warn(); return [] },
    async get(_id: string): Promise<any> { warn(); return undefined },
    async put(_data: any): Promise<void> { warn() },
    async bulkPut(_entries: any[]): Promise<void> { warn() },
    async bulkDelete(_ids: string[]): Promise<void> { warn() },
    async bulkGet(_ids: string[]): Promise<any[]> { warn(); return [] },
    async delete(_id: string): Promise<void> { warn() },
    async count(): Promise<number> { warn(); return 0 },
    async clear(): Promise<void> { warn() },
  }
}

export const db = {
  meta: createTableStub('meta'),
  ch: createTableStub('ch'),
  cfg: createTableStub('cfg'),
  ann: createTableStub('ann'),
  bm: createTableStub('bm'),
  lib: createTableStub('lib'),
  trash: createTableStub('trash'),
}

export async function initDb(): Promise<void> {
  if (withBridge()) {
    logger.info('Go SQLite database available via API bridge')
  } else {
    logger.warn('API bridge unavailable; running in browser dev mode')
  }
}

export async function clearAllData(): Promise<void> {
  try {
    await window.electronAPI?.clearAll()
    logger.info('All data cleared')
  } catch (e) {
    logger.warn('clearAll failed', e)
  }
}
