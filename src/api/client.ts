/** APIが返したエラー（`{ "error": メッセージ }`）。通信自体に失敗した場合は status が 0。 */
export class ApiRequestError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, init)
  } catch {
    throw new ApiRequestError(0, 'サーバーに接続できません')
  }

  if (!res.ok) {
    let message = `リクエストに失敗しました（${res.status}）`
    try {
      const body = (await res.json()) as { error?: unknown }
      if (typeof body.error === 'string') message = body.error
    } catch {
      // JSONでないエラー応答は既定のメッセージのまま
    }
    throw new ApiRequestError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
