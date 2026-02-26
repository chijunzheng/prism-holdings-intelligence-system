import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  CreatePlanSessionRequestSchema,
  UpdatePlanSessionRequestSchema,
  type PlanSession,
  type CreatePlanSessionRequest,
  type UpdatePlanSessionRequest,
} from '@prism/shared'

const MAX_SESSIONS_PER_USER = 50

interface PlanSessionStore {
  readonly sessions: ReadonlyArray<PlanSession>
}

const STORE_PATH = process.env.PRISM_PLAN_STORE_PATH ?? '.runtime/plan-sessions.json'

let store: PlanSessionStore | null = null

function loadStore(): PlanSessionStore {
  if (store) return store

  if (!existsSync(STORE_PATH)) {
    store = { sessions: [] }
    return store
  }

  try {
    const raw = readFileSync(STORE_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as { sessions?: ReadonlyArray<PlanSession> }
    store = { sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [] }
  } catch {
    store = { sessions: [] }
  }

  return store
}

function persistStore(next: PlanSessionStore): void {
  store = next
  const dir = dirname(STORE_PATH)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(STORE_PATH, JSON.stringify(next, null, 2), 'utf-8')
}

function generateId(): string {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function pruneUserSessions(
  sessions: ReadonlyArray<PlanSession>,
  userId: string,
): ReadonlyArray<PlanSession> {
  const userSessions = sessions.filter((s) => s.userId === userId)
  if (userSessions.length <= MAX_SESSIONS_PER_USER) return sessions

  const sorted = [...userSessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
  const keepIds = new Set(sorted.slice(0, MAX_SESSIONS_PER_USER).map((s) => s.id))

  return sessions.filter((s) => s.userId !== userId || keepIds.has(s.id))
}

export function listPlanSessions(userId: string): ReadonlyArray<PlanSession> {
  const { sessions } = loadStore()
  return sessions
    .filter((s) => s.userId === userId && s.status !== 'archived')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getPlanSession(userId: string, sessionId: string): PlanSession {
  const { sessions } = loadStore()
  const session = sessions.find((s) => s.id === sessionId && s.userId === userId)
  if (!session) {
    throw new Error(`Plan session ${sessionId} not found`)
  }
  return session
}

export function createPlanSession(
  userId: string,
  request: CreatePlanSessionRequest,
): PlanSession {
  const now = new Date().toISOString()
  const session: PlanSession = {
    id: generateId(),
    userId,
    signalId: request.signalId,
    signalHeadline: request.signalHeadline,
    title: request.title ?? request.signalHeadline,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    draft: null,
    selectedCandidateIds: [],
    scenario: null,
    evaluation: null,
    affectedExposures: request.affectedExposures ?? [],
  }

  const { sessions } = loadStore()
  const pruned = pruneUserSessions([...sessions, session], userId)
  persistStore({ sessions: [...pruned] })

  return session
}

export function updatePlanSession(
  userId: string,
  sessionId: string,
  request: UpdatePlanSessionRequest,
): PlanSession {
  const { sessions } = loadStore()
  const index = sessions.findIndex((s) => s.id === sessionId && s.userId === userId)
  if (index === -1) {
    throw new Error(`Plan session ${sessionId} not found`)
  }

  const updated: PlanSession = {
    ...sessions[index],
    ...Object.fromEntries(Object.entries(request).filter(([, v]) => v !== undefined)),
    updatedAt: new Date().toISOString(),
  }

  const next = sessions.map((s, i) => (i === index ? updated : s))
  persistStore({ sessions: [...next] })

  return updated
}

export function deletePlanSession(userId: string, sessionId: string): void {
  const { sessions } = loadStore()
  const next = sessions.filter((s) => !(s.id === sessionId && s.userId === userId))

  if (next.length === sessions.length) {
    throw new Error(`Plan session ${sessionId} not found`)
  }

  persistStore({ sessions: [...next] })
}

export { CreatePlanSessionRequestSchema, UpdatePlanSessionRequestSchema }
