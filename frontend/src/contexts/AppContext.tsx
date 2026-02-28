import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { AskPrismEntryContext } from '@prism/shared'

interface DemoProfile {
  readonly id: string
  readonly name: string
  readonly age: number
  readonly riskTolerance: string
  readonly context: string
  readonly shortContext?: string
}

interface HoldingContext {
  readonly ticker: string
  readonly name: string
  readonly accountType: string
}

export interface SidebarContext {
  readonly type: 'concentration' | 'exposure' | 'overlap' | 'health'
  readonly label: string
  readonly detail: string
}

interface AppState {
  readonly userId: string
  readonly profiles: ReadonlyArray<DemoProfile>
  readonly profilesLoading: boolean
  readonly activeHoldingContext: HoldingContext | null
  readonly activeSidebarContext: SidebarContext | null
  readonly activeAskPrismEntryContext: AskPrismEntryContext | null
  readonly askPrismOpen: boolean
  readonly setUserId: (id: string) => void
  readonly loadProfiles: () => void
  readonly setActiveHoldingContext: (context: HoldingContext | null) => void
  readonly setActiveSidebarContext: (context: SidebarContext | null) => void
  readonly setActiveAskPrismEntryContext: (context: AskPrismEntryContext | null) => void
  readonly setAskPrismOpen: (open: boolean) => void
}

const AppContext = createContext<AppState | null>(null)

interface AppProviderProps {
  readonly children: ReactNode
}

export function AppProvider({ children }: AppProviderProps) {
  const [userId, setUserIdRaw] = useState('sarah-01')

  const setUserId = useCallback((id: string) => {
    setUserIdRaw(id)
    // Clear server-side caches when switching profiles
    fetch('/api/cache/clear', { method: 'POST' }).catch(() => {})
  }, [])
  const [activeHoldingContext, setActiveHoldingContext] = useState<HoldingContext | null>(null)
  const [activeSidebarContext, setActiveSidebarContext] = useState<SidebarContext | null>(null)
  const [activeAskPrismEntryContext, setActiveAskPrismEntryContext] = useState<AskPrismEntryContext | null>(null)
  const [askPrismOpen, setAskPrismOpen] = useState(false)
  const [profiles, setProfiles] = useState<ReadonlyArray<DemoProfile>>([])
  const [profilesLoading, setProfilesLoading] = useState(false)

  const loadProfiles = useCallback(() => {
    if (profiles.length > 0) return
    setProfilesLoading(true)

    fetch('/api/profiles')
      .then((res) => res.json())
      .then((payload: { success: boolean; data?: ReadonlyArray<DemoProfile> }) => {
        if (payload.success && payload.data) {
          setProfiles(payload.data)
        }
        setProfilesLoading(false)
      })
      .catch(() => {
        setProfilesLoading(false)
      })
  }, [profiles.length])

  return (
    <AppContext.Provider value={{ userId, profiles, profilesLoading, activeHoldingContext, activeSidebarContext, activeAskPrismEntryContext, askPrismOpen, setUserId, loadProfiles, setActiveHoldingContext, setActiveSidebarContext, setActiveAskPrismEntryContext, setAskPrismOpen }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext(): AppState {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider')
  }
  return context
}
