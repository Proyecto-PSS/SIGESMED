// Utilidad compartida de llamadas HTTP con resiliencia, timeouts y reintentos (US-18).
import { RESERVA_CONFIG } from '../config/reserva-config.ts'

export const esperar = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

export function esErrorTransitorio(status?: number, error?: unknown): boolean {
  if (status && (RESERVA_CONFIG.TRANSIENT_STATUS_CODES as readonly number[]).includes(status)) {
    return true
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') return true
    if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
      return true
    }
  }

  return false
}

export async function fetchConTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = RESERVA_CONFIG.REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}
