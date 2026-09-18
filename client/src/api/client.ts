export type AuthUser = {
  id: string
  username: string
  email: string
}

type ApiErrorBody = {
  error?: string
}

const TOKEN_KEY = 'lumen_token'

/** JWT helpers; token in localStorage for session restore */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

/** Fetch wrapper: JSON body, Bearer auth, throws Error with API `error` message. */
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(path, { ...options, headers })
  const data = (await res.json().catch(() => ({}))) as T & ApiErrorBody

  if (!res.ok) {
    throw new Error(data.error || `request failed (${res.status})`)
  }

  return data
}
