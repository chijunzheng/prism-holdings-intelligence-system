export type FrequencySuppressionReason = 'frequency_cap' | 'duplicate'

interface DailyCounter {
  dayKey: string
  count: number
}

interface ChainAlertState {
  lastMagnitude: number
  lastAlertedAt: number
}

interface AlertFrequencyState {
  counters: Map<string, DailyCounter>
  chainStates: Map<string, Map<string, ChainAlertState>>
}

const state: AlertFrequencyState = {
  counters: new Map(),
  chainStates: new Map(),
}

function toDayKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

function getOrCreateCounter(userId: string, dayKey: string): DailyCounter {
  const current = state.counters.get(userId)
  if (!current || current.dayKey !== dayKey) {
    const next = { dayKey, count: 0 }
    state.counters.set(userId, next)
    return next
  }
  return current
}

function getOrCreateChainMap(userId: string): Map<string, ChainAlertState> {
  const existing = state.chainStates.get(userId)
  if (existing) return existing
  const created = new Map<string, ChainAlertState>()
  state.chainStates.set(userId, created)
  return created
}

function hasMaterialMagnitudeChange(previous: number, next: number): boolean {
  const baseline = Math.max(Math.abs(previous), 1)
  const pctDelta = Math.abs(next - previous) / baseline
  return pctDelta >= 0.15
}

export function evaluateAlertDispatch(params: {
  userId: string
  chainId: string
  magnitudeCad: number
  effectiveDailyCap: number
  now?: Date
}): { readonly allowed: boolean; readonly reason?: FrequencySuppressionReason } {
  const now = params.now ?? new Date()
  const dayKey = toDayKey(now)
  const counter = getOrCreateCounter(params.userId, dayKey)
  const chainMap = getOrCreateChainMap(params.userId)
  const existingChain = chainMap.get(params.chainId)

  if (existingChain && !hasMaterialMagnitudeChange(existingChain.lastMagnitude, params.magnitudeCad)) {
    return { allowed: false, reason: 'duplicate' }
  }

  if (counter.count >= params.effectiveDailyCap) {
    return { allowed: false, reason: 'frequency_cap' }
  }

  counter.count += 1
  chainMap.set(params.chainId, {
    lastMagnitude: params.magnitudeCad,
    lastAlertedAt: now.getTime(),
  })

  return { allowed: true }
}

export function resetAlertFrequencyState(): void {
  state.counters.clear()
  state.chainStates.clear()
}
