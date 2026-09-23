import { request } from './client'

export interface BackupData {
  version: number
  exported_at: string
  books: unknown[]
  reading_logs: unknown[]
  quotes: unknown[]
  goals: unknown[]
}

export interface ImportResult {
  books: number
  reading_logs: number
  quotes: number
  goals: number
}

export function exportBackup(): Promise<BackupData> {
  return request<BackupData>('/api/export')
}

/**
 * バックアップを復元する。既存データはすべて消え、渡した内容に置き換わる。
 * `data` はインポート用JSONをパースしたもの（形式が正しいかはサーバー側で検証する）。
 */
export function importBackup(data: unknown): Promise<ImportResult> {
  return request<ImportResult>('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}
