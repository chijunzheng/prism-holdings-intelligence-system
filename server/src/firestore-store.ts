// Firestore-backed persistence for Cloud Run deployment.
// When FIREBASE_PROJECT_ID is set, data persists across restarts.
// Otherwise, falls back to in-memory Maps for local development.

import { Firestore } from '@google-cloud/firestore'
import type { AnalysisSession } from './routes/sessions'
import type { ThreadContext } from './routes/thread-context'

// ── Feature Flag ────────────────────────────────────────────

export const USE_FIRESTORE = Boolean(process.env.FIREBASE_PROJECT_ID)

// ── Firestore Client (lazy, only created when flag is on) ───

let _db: Firestore | null = null

function db(): Firestore {
  if (!_db) {
    _db = new Firestore({ projectId: process.env.FIREBASE_PROJECT_ID })
  }
  return _db
}

const SESSIONS_COLLECTION = 'prism_sessions'
const THREAD_CTX_COLLECTION = 'prism_thread_contexts'

// ── In-Memory Fallback ──────────────────────────────────────

const memSessions = new Map<string, AnalysisSession>()
const memThreadCtx = new Map<string, ThreadContext>()

// ── Session Operations ──────────────────────────────────────

export async function getSessionsByUser(userId: string): Promise<readonly AnalysisSession[]> {
  if (!USE_FIRESTORE) {
    return [...memSessions.values()]
      .filter((s) => s.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }

  const snapshot = await db()
    .collection(SESSIONS_COLLECTION)
    .where('userId', '==', userId)
    .orderBy('updatedAt', 'desc')
    .get()

  return snapshot.docs.map((doc) => doc.data() as AnalysisSession)
}

export async function getSession(sessionId: string): Promise<AnalysisSession | undefined> {
  if (!USE_FIRESTORE) {
    return memSessions.get(sessionId)
  }

  const doc = await db().collection(SESSIONS_COLLECTION).doc(sessionId).get()
  return doc.exists ? (doc.data() as AnalysisSession) : undefined
}

export async function setSession(session: AnalysisSession): Promise<void> {
  if (!USE_FIRESTORE) {
    memSessions.set(session.id, session)
    return
  }

  await db().collection(SESSIONS_COLLECTION).doc(session.id).set(
    JSON.parse(JSON.stringify(session)) // Strip readonly for Firestore
  )
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  if (!USE_FIRESTORE) {
    return memSessions.delete(sessionId)
  }

  const ref = db().collection(SESSIONS_COLLECTION).doc(sessionId)
  const doc = await ref.get()
  if (!doc.exists) return false
  await ref.delete()
  return true
}

export async function countUserSessions(userId: string): Promise<number> {
  if (!USE_FIRESTORE) {
    return [...memSessions.values()].filter((s) => s.userId === userId).length
  }

  const agg = await db()
    .collection(SESSIONS_COLLECTION)
    .where('userId', '==', userId)
    .count()
    .get()

  return agg.data().count
}

// ── Thread Context Operations ───────────────────────────────

export async function getThreadContext(threadId: string): Promise<ThreadContext | undefined> {
  if (!USE_FIRESTORE) {
    return memThreadCtx.get(threadId)
  }

  const doc = await db().collection(THREAD_CTX_COLLECTION).doc(threadId).get()
  return doc.exists ? (doc.data() as ThreadContext) : undefined
}

export async function setThreadContext(threadId: string, ctx: ThreadContext): Promise<void> {
  if (!USE_FIRESTORE) {
    memThreadCtx.set(threadId, ctx)
    return
  }

  await db().collection(THREAD_CTX_COLLECTION).doc(threadId).set(
    JSON.parse(JSON.stringify(ctx))
  )
}

export async function deleteThreadContext(threadId: string): Promise<void> {
  if (!USE_FIRESTORE) {
    memThreadCtx.delete(threadId)
    return
  }

  await db().collection(THREAD_CTX_COLLECTION).doc(threadId).delete()
}
