import { useState, useEffect } from 'react'
import type { ExposureMap } from '@prism/shared'

interface ExposureDataState {
  readonly exposureMap: ExposureMap | null
  readonly loading: boolean
  readonly error: string | null
}

/**
 * Fetches exposure analysis from the server API.
 * Caches result in state; re-fetches on userId change.
 */
export function useExposureData(userId: string): ExposureDataState {
  const [state, setState] = useState<ExposureDataState>({
    exposureMap: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    async function fetchExposure() {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const response = await fetch(`/api/exposure/${userId}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch exposure data: ${response.statusText}`)
        }
        const data = await response.json()

        if (!cancelled) {
          setState({ exposureMap: data.data, loading: false, error: null })
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            exposureMap: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      }
    }

    fetchExposure()
    return () => {
      cancelled = true
    }
  }, [userId])

  return state
}
