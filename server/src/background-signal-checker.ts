import { createNotification } from './notification-service'
import type { Signal, NotificationUrgency } from '@prism/shared'

type SignalFetcher = (userId: string) => Promise<ReadonlyArray<Signal>>

const activeUsers = new Map<string, number>()
const lastKnownSignals = new Map<string, Set<string>>()
const ACTIVE_USER_TTL_MS = 24 * 60 * 60 * 1000

let intervalId: ReturnType<typeof setInterval> | null = null

function hashSignal(signal: Signal): string {
  return `${signal.headline}::${signal.id}`
}

function classifyUrgency(signal: Signal): NotificationUrgency {
  if (signal.urgency === 'critical' && signal.relevanceScore >= 0.8) return 'critical'
  if (signal.urgency === 'high' || signal.relevanceScore >= 0.6) return 'high'
  return 'medium'
}

export function trackActiveUser(userId: string): void {
  activeUsers.set(userId, Date.now())
}

function pruneInactiveUsers(): void {
  const cutoff = Date.now() - ACTIVE_USER_TTL_MS
  for (const [userId, lastSeen] of activeUsers) {
    if (lastSeen < cutoff) {
      activeUsers.delete(userId)
      lastKnownSignals.delete(userId)
    }
  }
}

async function checkSignalsForUser(
  userId: string,
  fetchSignals: SignalFetcher,
): Promise<void> {
  try {
    const signals = await fetchSignals(userId)
    const known = lastKnownSignals.get(userId) ?? new Set<string>()
    const currentHashes = new Set(signals.map(hashSignal))

    for (const signal of signals) {
      const hash = hashSignal(signal)
      if (known.has(hash)) continue

      const urgency = classifyUrgency(signal)
      if (signal.relevanceScore < 0.4) continue

      createNotification({
        userId,
        type: 'new_signal',
        signalId: signal.id,
        headline: signal.headline,
        description: signal.description,
        urgency,
      })
    }

    lastKnownSignals.set(userId, currentHashes)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    // eslint-disable-next-line no-console
    console.error(`[BackgroundChecker] Failed for user ${userId}:`, message)
  }
}

export function startBackgroundChecker(
  fetchSignals: SignalFetcher,
  intervalMs?: number,
): void {
  if (intervalId) return

  const checkIntervalMs = intervalMs ?? (Number(process.env.SIGNAL_CHECK_INTERVAL_MS) || 60_000)

  // eslint-disable-next-line no-console
  console.log(`[BackgroundChecker] Starting with ${checkIntervalMs}ms interval`)

  const runCheck = async () => {
    pruneInactiveUsers()
    const userIds = [...activeUsers.keys()]
    await Promise.allSettled(
      userIds.map((userId) => checkSignalsForUser(userId, fetchSignals)),
    )
  }

  intervalId = setInterval(() => void runCheck(), checkIntervalMs)

  // Run first check after a short delay (let server finish starting)
  setTimeout(() => void runCheck(), 5_000)
}

export function stopBackgroundChecker(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

export function clearCheckerState(userId: string): void {
  lastKnownSignals.delete(userId)
}
