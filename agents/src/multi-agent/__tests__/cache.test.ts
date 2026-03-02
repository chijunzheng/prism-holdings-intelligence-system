import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryCacheStore, verdictCacheKey, briefCacheKey, portfolioVerdictCacheKey } from '../cache'

describe('InMemoryCacheStore', () => {
  let store: InMemoryCacheStore

  beforeEach(() => {
    store = new InMemoryCacheStore()
  })

  it('returns null for missing keys', async () => {
    const result = await store.get('nonexistent')
    expect(result).toBeNull()
  })

  it('stores and retrieves values', async () => {
    await store.set('key1', { foo: 'bar' }, 60_000)
    const result = await store.get<{ foo: string }>('key1')
    expect(result).toEqual({ foo: 'bar' })
  })

  it('returns null for expired entries', async () => {
    await store.set('key1', 'value', 1) // TTL of 1ms
    // Wait enough for expiry
    await new Promise((resolve) => setTimeout(resolve, 10))
    const result = await store.get('key1')
    expect(result).toBeNull()
  })

  it('deletes entries', async () => {
    await store.set('key1', 'value', 60_000)
    await store.delete('key1')
    const result = await store.get('key1')
    expect(result).toBeNull()
  })

  it('clears all entries', async () => {
    await store.set('key1', 'a', 60_000)
    await store.set('key2', 'b', 60_000)
    expect(store.size).toBe(2)
    await store.clear()
    expect(store.size).toBe(0)
  })

  it('overwrites existing keys', async () => {
    await store.set('key1', 'old', 60_000)
    await store.set('key1', 'new', 60_000)
    const result = await store.get('key1')
    expect(result).toBe('new')
  })
})

describe('cache key builders', () => {
  it('builds verdict cache key', () => {
    expect(verdictCacheKey('sig-1', 'user-1')).toBe('verdict:user-1:sig-1')
  })

  it('builds brief cache key', () => {
    expect(briefCacheKey('sig-1', 'user-1')).toBe('brief:user-1:sig-1')
  })

  it('builds portfolio verdict cache key', () => {
    expect(portfolioVerdictCacheKey('user-1')).toBe('portfolio-verdict:user-1')
  })
})
