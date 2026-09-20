import type { ContentfulStatusCode } from 'hono/utils/http-status'

/** `{ "error": メッセージ }` とステータスコードで返すエラー。 */
export class ApiError extends Error {
  status: ContentfulStatusCode

  constructor(status: ContentfulStatusCode, message: string) {
    super(message)
    this.status = status
  }
}
