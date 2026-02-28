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
    const path = location.pathname.replace(/\/+$/, '') || '/'

    const planMatch = path.match(/^\/signals\/([^/]+)\/plan$/)
    if (planMatch?.[1]) {
      return { page: 'plan' as const, signalId: decodeURIComponent(planMatch[1]) }
    }

    const signalMatch = path.match(/^\/signals\/([^/]+)$/)
    if (signalMatch?.[1]) {
      return { page: 'signal' as const, signalId: decodeURIComponent(signalMatch[1]) }
    }

    if (params.signalId && path.startsWith('/signals/')) {
      return { page: 'signal' as const, signalId: params.signalId }
    }

    if (path === '/signals') {
      return { page: 'signals_overview' as const }
    }

    return { page: 'portfolio' as const }
  }, [location.pathname, params.signalId])
}
