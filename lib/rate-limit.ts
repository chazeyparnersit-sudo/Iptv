const attempts = new Map<string, { count: number; resetAt: number }>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 60 * 1000 // 1 minuto
const SWEEP_INTERVAL_MS = 10 * 60 * 1000 // 10 minutos

// El Map nunca borraba entradas vencidas por su cuenta (solo las
// sobreescribía si esa MISMA IP volvía a intentar). Con el tiempo, cada IP
// distinta que alguna vez intentó loguearse quedaba ocupando memoria para
// siempre. Un barrido periódico saca las que ya vencieron.
const sweepTimer = setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of attempts) {
    if (now > entry.resetAt) attempts.delete(ip)
  }
}, SWEEP_INTERVAL_MS)
sweepTimer.unref?.() // no debe mantener vivo el proceso solo por este timer

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const entry = attempts.get(ip)

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterMs: entry.resetAt - now }
  }

  entry.count++
  return { allowed: true, retryAfterMs: 0 }
}

export function clearRateLimit(ip: string): void {
  attempts.delete(ip)
}
