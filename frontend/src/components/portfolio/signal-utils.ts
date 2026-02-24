import { MAX_ACTIVE_SIGNALS, type Signal, type TemporalClassification } from '@prism/shared'

export type Materiality = 'low' | 'medium' | 'high'
export type BadgeVariant = TemporalClassification

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const VIEWED_SIGNALS_STORAGE_PREFIX = 'prism.viewed.signals'

const URGENCY_SCORE: Record<Signal['urgency'], number> = {
  low: 0.5,
  medium: 1.25,
  high: 2,
  critical: 2.75,
}

function getSignalPriority(signal: Signal): number {
  const recencyBoost = Date.parse(signal.detectedAt) / 1e14
  return URGENCY_SCORE[signal.urgency] + signal.relevanceScore + recencyBoost
}

export function getMateriality(signal: Signal): Materiality {
  if (signal.urgency === 'critical') return 'high'
  const score = URGENCY_SCORE[signal.urgency] + signal.relevanceScore
  if (score >= 2.7) return 'high'
  if (score >= 1.9) return 'medium'
  return 'low'
}

export function getBadgeVariant(classification: TemporalClassification): BadgeVariant {
  return classification
}

export function sortSignalsForCards(signals: ReadonlyArray<Signal>): ReadonlyArray<Signal> {
  return [...signals].sort((a, b) => getSignalPriority(b) - getSignalPriority(a))
}

export function getVisibleSignals(
  signals: ReadonlyArray<Signal>,
  maxCards = MAX_ACTIVE_SIGNALS,
): ReadonlyArray<Signal> {
  return sortSignalsForCards(signals).slice(0, maxCards)
}

export function getOverflowCount(
  signals: ReadonlyArray<Signal>,
  maxCards = MAX_ACTIVE_SIGNALS,
): number {
  return Math.max(0, signals.length - maxCards)
}

export function buildSignalGraphRoute(signalId: string): string {
  return `/graph/${encodeURIComponent(signalId)}`
}

export function viewedSignalsStorageKey(userId: string): string {
  return `${VIEWED_SIGNALS_STORAGE_PREFIX}:${userId}`
}

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function readViewedSignalIds(userId: string, storage?: StorageLike): ReadonlySet<string> {
  const safeStorage = resolveStorage(storage)
  if (!safeStorage) return new Set<string>()

  const raw = safeStorage.getItem(viewedSignalsStorageKey(userId))
  if (!raw) return new Set<string>()

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set<string>()
    return new Set(parsed.filter((value): value is string => typeof value === 'string'))
  } catch {
    return new Set<string>()
  }
}

function writeViewedSignalIds(
  userId: string,
  signalIds: ReadonlySet<string>,
  storage?: StorageLike,
): void {
  const safeStorage = resolveStorage(storage)
  if (!safeStorage) return
  safeStorage.setItem(viewedSignalsStorageKey(userId), JSON.stringify(Array.from(signalIds)))
}

export function markSignalViewed(
  userId: string,
  signalId: string,
  storage?: StorageLike,
): ReadonlySet<string> {
  const next = new Set(readViewedSignalIds(userId, storage))
  next.add(signalId)
  writeViewedSignalIds(userId, next, storage)
  return next
}
