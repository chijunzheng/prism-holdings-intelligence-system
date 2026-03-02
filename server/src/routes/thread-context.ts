// Thread Context Map — shared state for paused pipeline checkpoints.
// Used by both analyze.ts and chat-router.ts to store/resume pipeline context.

import type { Signal } from '@prism/shared'

export interface ThreadContext {
  readonly signal: Signal
  readonly userId: string
}

export const threadContextMap = new Map<string, ThreadContext>()
