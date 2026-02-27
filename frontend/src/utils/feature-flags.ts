function parseBoolean(value: unknown, defaultValue: boolean): boolean {
  if (typeof value !== 'string') return defaultValue
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return defaultValue
}

export const UNIFIED_WORKSPACE_ENABLED = parseBoolean(
  (import.meta as ImportMeta & { readonly env?: Record<string, string | undefined> }).env
    ?.VITE_PRISM_UNIFIED_WORKSPACE,
  true,
)
