/**
 * Web Worker for heavy file parsing.
 * Runs parseBook in a separate thread to prevent UI freezes during imports.
 *
 * Receives: { filePath: string, fileName: string, fileData: ArrayBuffer, fileSize: number }
 * Returns:  { type: 'result', data: ParsedBook }
 *        or { type: 'error', error: string }
 * Posts progress: { type: 'progress', message: string }
 */

import { parseBook } from './parser'

export interface WorkerRequest {
  filePath: string
  fileName: string
  fileData: ArrayBuffer
  fileSize: number
}

export interface WorkerProgress {
  type: 'progress'
  message: string
}

export interface WorkerResult {
  type: 'result'
  data: any // ParsedBook
}

export interface WorkerError {
  type: 'error'
  error: string
}

export type WorkerResponse = WorkerProgress | WorkerResult | WorkerError

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { filePath, fileName, fileData, fileSize } = e.data
  try {
    self.postMessage({ type: 'progress', message: `正在解析 ${fileName}...` } satisfies WorkerProgress)
    const result = await parseBook(filePath, fileName, fileData, fileSize)
    self.postMessage({ type: 'result', data: result } satisfies WorkerResult)
  } catch (err: any) {
    self.postMessage({ type: 'error', error: err?.message || String(err) } satisfies WorkerError)
  }
}
