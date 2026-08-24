/**
 * uploadImage.ts — Send a VTT image to the server and get back a URL.
 *
 * Everything the VTT renders — maps, props, token art — must live at a URL the
 * whole table can fetch. Data URLs were the old approach and had three
 * problems: they never reached other players, they died with the browser
 * profile, and embedding megabytes of base64 in the scene meant every edit
 * pushed the whole payload over the socket and into Postgres.
 *
 * Uploads are gated by an admin setting server-side, so callers must be ready
 * for a refusal and fall back or surface the message.
 */

const TOKEN_KEY = 'cc_token'

export type UploadPurpose = 'vtt_map' | 'vtt_token' | 'vtt_prop'

export interface UploadResult {
  id:   string
  url:  string
  size: number
}

/** Thrown when the server declines the upload. `.message` is user-facing. */
export class UploadError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name   = 'UploadError'
    this.status = status
  }
}

export async function uploadImage(file: File, purpose: UploadPurpose): Promise<UploadResult> {
  const body = new FormData()
  body.append('file', file)
  body.append('purpose', purpose)

  let res: Response
  try {
    res = await fetch('/api/upload', {
      method:  'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ''}` },
      body,
    })
  } catch {
    throw new UploadError('Could not reach the server.', 0)
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => null) as { error?: string } | null
    throw new UploadError(detail?.error ?? `Upload failed (${res.status}).`, res.status)
  }

  return await res.json() as UploadResult
}

/** Read an image file's natural dimensions without adding it to the document. */
export function imageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image.'))
    }
    img.src = url
  })
}
