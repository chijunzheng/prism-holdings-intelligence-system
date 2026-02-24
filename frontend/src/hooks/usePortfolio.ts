import { useEffect, useState } from 'react'
import type { Portfolio } from '@prism/shared'

interface UsePortfolioResult {
  readonly portfolio: Portfolio | null
  readonly loading: boolean
  readonly error: string | null
}

export function usePortfolio(userId: string): UsePortfolioResult {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/portfolio/${encodeURIComponent(userId)}`)
      .then((res) => res.json())
      .then((payload: { success: boolean; data?: Portfolio; error?: string }) => {
        if (cancelled) return
        if (payload.success && payload.data) {
          setPortfolio(payload.data)
        } else {
          setError(payload.error ?? 'Failed to load portfolio')
        }
        setLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  return { portfolio, loading, error }
}
