// Thread Context — shared state for paused pipeline checkpoints.
// Used by both analyze.ts and chat-router.ts to store/resume pipeline context.

import type { Signal } from '@prism/shared'
import {
  getThreadContext,
  setThreadContext,
  deleteThreadContext,
} from '../firestore-store'

export interface ThreadContext {
  readonly signal: Signal
  readonly userId: string
}

export async function getThreadCtx(threadId: string): Promise<ThreadContext | undefined> {
  return getThreadContext(threadId)
}

export async function setThreadCtx(threadId: string, ctx: ThreadContext): Promise<void> {
  return setThreadContext(threadId, ctx)
}

export async function deleteThreadCtx(threadId: string): Promise<void> {
  return deleteThreadContext(threadId)
}
