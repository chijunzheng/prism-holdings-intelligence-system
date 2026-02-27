import { useCallback, useEffect, useRef } from 'react'
import type { WorkspaceOperation, WorkspaceSnapshot } from '../types/workspace'

interface AutosaveOptions {
  readonly sessionId: string | null
  readonly branchId: string | null
  readonly snapshot: WorkspaceSnapshot
  readonly appendOperation: (
    sessionId: string,
    request: {
      readonly branchId: string
      readonly type: WorkspaceOperation['type']
      readonly payload?: Record<string, unknown>
      readonly actor?: WorkspaceOperation['actor']
      readonly snapshot?: WorkspaceSnapshot
    },
  ) => Promise<WorkspaceOperation | null>
}

export function useWorkspaceAutosave({
  sessionId,
  branchId,
  snapshot,
  appendOperation,
}: AutosaveOptions): {
  readonly queueAutosave: (
    type: WorkspaceOperation['type'],
    payload?: Record<string, unknown>,
  ) => void
  readonly flushAutosave: () => Promise<void>
} {
  const timerRef = useRef<number | null>(null)
  const pendingRef = useRef<{
    readonly type: WorkspaceOperation['type']
    readonly payload?: Record<string, unknown>
  } | null>(null)
  const snapshotRef = useRef(snapshot)

  snapshotRef.current = snapshot

  const flushAutosave = useCallback(async (): Promise<void> => {
    if (!sessionId || !branchId) return
    if (!pendingRef.current) return

    const pending = pendingRef.current
    pendingRef.current = null
    await appendOperation(sessionId, {
      branchId,
      type: pending.type,
      payload: pending.payload,
      actor: 'human',
      snapshot: snapshotRef.current,
    })
  }, [appendOperation, branchId, sessionId])

  const queueAutosave = useCallback(
    (type: WorkspaceOperation['type'], payload?: Record<string, unknown>): void => {
      pendingRef.current = { type, payload }

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        void flushAutosave()
      }, 1500)
    },
    [flushAutosave],
  )

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  return { queueAutosave, flushAutosave }
}
