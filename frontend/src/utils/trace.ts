function asWindow(): Window | null {
  if (typeof window === 'undefined') return null
  return window
}

function hasTruthy(value: string | null | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export function isImpactTraceEnabled(): boolean {
  const win = asWindow()
  if (!win) return false

  const search = new URLSearchParams(win.location.search)
  if (hasTruthy(search.get('traceImpact'))) return true

  const local = win.localStorage.getItem('prism.trace.impact')
  return hasTruthy(local)
}

export function traceImpact(scope: string, payload: unknown): void {
  if (!isImpactTraceEnabled()) return
  // eslint-disable-next-line no-console
  console.debug(`[PrismTrace][${scope}]`, payload)
}
