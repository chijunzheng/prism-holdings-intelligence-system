import { useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import type { AskPrismPage } from '@prism/shared'

export interface PageContext {
  readonly page: AskPrismPage
  readonly signalId?: string
}

export function usePageContext(): PageContext {
  const location = useLocation()
  const params = useParams<{ signalId?: string }>()

  return useMemo(() => {
    const path = location.pathname

    if (params.signalId && path.endsWith('/plan')) {
      return { page: 'plan' as const, signalId: params.signalId }
    }

    if (params.signalId && path.startsWith('/signals/')) {
      return { page: 'signal' as const, signalId: params.signalId }
    }

    return { page: 'portfolio' as const }
  }, [location.pathname, params.signalId])
}
