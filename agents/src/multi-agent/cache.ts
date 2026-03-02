// CacheStore — abstraction for pipeline artifact caching.
// InMemoryCacheStore for prototype; interface ready for Redis/Firestore swap.

export interface CacheStore {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlMs: number): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
}

type CacheEntry = {
  readonly value: unknown
  readonly expiresAt: number
}

export class InMemoryCacheStore implements CacheStore {
  private readonly store = new Map<string, CacheEntry>()

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }

    return entry.value as T
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async clear(): Promise<void> {
    this.store.clear()
  }

  /** Number of entries (including expired — for testing) */
  get size(): number {
    return this.store.size
  }
}

// ── Cache Key Builders ──────────────────────────────────────

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

export function verdictCacheKey(signalId: string, userId: string): string {
  return `verdict:${userId}:${signalId}`
}

export function briefCacheKey(signalId: string, userId: string): string {
  return `brief:${userId}:${signalId}`
}

export function portfolioVerdictCacheKey(userId: string): string {
  return `portfolio-verdict:${userId}`
}

export const DEFAULT_VERDICT_TTL = TWENTY_FOUR_HOURS
export const DEFAULT_BRIEF_TTL = TWENTY_FOUR_HOURS
