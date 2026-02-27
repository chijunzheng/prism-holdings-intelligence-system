import { mkdir, readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { dirname, resolve } from 'path'
import {
  WorkspaceBranchCompareSchema,
  WorkspaceBranchSchema,
  WorkspaceCheckpointSchema,
  WorkspaceOperationSchema,
  WorkspaceSessionBundleSchema,
  WorkspaceSessionSchema,
  type CreateWorkspaceBranchRequest,
  type CreateWorkspaceCheckpointRequest,
  type CreateWorkspaceSessionRequest,
  type UpdateWorkspaceBranchRequest,
  type UpdateWorkspaceSessionRequest,
  type WorkspaceBranch,
  type WorkspaceBranchCompare,
  type WorkspaceCheckpoint,
  type WorkspaceOperation,
  type WorkspaceSession,
  type WorkspaceSessionBundle,
  type WorkspaceSnapshot,
} from '@prism/shared'

interface WorkspaceStore {
  readonly sessions: ReadonlyArray<WorkspaceSession>
  readonly branches: ReadonlyArray<WorkspaceBranch>
  readonly checkpoints: ReadonlyArray<WorkspaceCheckpoint>
  readonly operations: ReadonlyArray<WorkspaceOperation>
}

const EMPTY_SNAPSHOT: WorkspaceSnapshot = {
  graphLayers: [],
  scenario: { items: [] },
  evaluation: null,
  selectedSignalId: null,
  selectedNodeId: null,
}

const MAX_SESSIONS_PER_USER = 50
const MAX_CHECKPOINTS_PER_USER = 200

const configuredStorePath = process.env.PRISM_WORKSPACE_STORE_PATH ?? '.runtime/workspace-sessions.json'
const storePath = resolve(process.cwd(), configuredStorePath)
const runtimeDir = dirname(storePath)

let store: WorkspaceStore | null = null

function nowIso(): string {
  return new Date().toISOString()
}

function defaultTitle(request: CreateWorkspaceSessionRequest): string {
  if (request.title?.trim()) return request.title.trim()
  const stamp = new Date().toISOString().slice(0, 10)
  if (request.scope === 'signal' && request.signalId) return `${request.signalId} - ${stamp}`
  return `Portfolio Workspace - ${stamp}`
}

async function ensureLoaded(): Promise<void> {
  if (store) return
  if (!existsSync(storePath)) {
    store = {
      sessions: [],
      branches: [],
      checkpoints: [],
      operations: [],
    }
    return
  }

  try {
    const raw = await readFile(storePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<WorkspaceStore>
    store = {
      sessions: Array.isArray(parsed.sessions)
        ? parsed.sessions
            .map((entry) => WorkspaceSessionSchema.safeParse(entry))
            .filter((entry): entry is { success: true; data: WorkspaceSession } => entry.success)
            .map((entry) => entry.data)
        : [],
      branches: Array.isArray(parsed.branches)
        ? parsed.branches
            .map((entry) => WorkspaceBranchSchema.safeParse(entry))
            .filter((entry): entry is { success: true; data: WorkspaceBranch } => entry.success)
            .map((entry) => entry.data)
        : [],
      checkpoints: Array.isArray(parsed.checkpoints)
        ? parsed.checkpoints
            .map((entry) => WorkspaceCheckpointSchema.safeParse(entry))
            .filter((entry): entry is { success: true; data: WorkspaceCheckpoint } => entry.success)
            .map((entry) => entry.data)
        : [],
      operations: Array.isArray(parsed.operations)
        ? parsed.operations
            .map((entry) => WorkspaceOperationSchema.safeParse(entry))
            .filter((entry): entry is { success: true; data: WorkspaceOperation } => entry.success)
            .map((entry) => entry.data)
        : [],
    }
  } catch {
    store = {
      sessions: [],
      branches: [],
      checkpoints: [],
      operations: [],
    }
  }
}

async function persist(): Promise<void> {
  await ensureLoaded()
  await mkdir(runtimeDir, { recursive: true })
  await writeFile(storePath, JSON.stringify(store, null, 2), 'utf-8')
}

function requireStore(): WorkspaceStore {
  if (!store) {
    throw new Error('Workspace store not loaded')
  }
  return store
}

function latestCheckpoint(checkpoints: ReadonlyArray<WorkspaceCheckpoint>, branchId: string): WorkspaceCheckpoint | null {
  const found = checkpoints
    .filter((checkpoint) => checkpoint.branchId === branchId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  return found ?? null
}

function nodeCountFromSnapshot(snapshot: WorkspaceSnapshot): number {
  return snapshot.graphLayers.reduce((sum, layer) => sum + layer.chain.nodes.length, 0)
}

function edgeCountFromSnapshot(snapshot: WorkspaceSnapshot): number {
  return snapshot.graphLayers.reduce((sum, layer) => sum + layer.chain.edges.length, 0)
}

function pruneUserRetention(userId: string): void {
  const current = requireStore()

  const sessionsByUser = current.sessions
    .filter((session) => session.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const keepSessionIds = new Set(sessionsByUser.slice(0, MAX_SESSIONS_PER_USER).map((session) => session.id))

  const sessionPruned = current.sessions.filter(
    (session) => session.userId !== userId || keepSessionIds.has(session.id),
  )
  const survivingSessionIds = new Set(sessionPruned.map((session) => session.id))
  const survivingSessionById = new Map(sessionPruned.map((session) => [session.id, session]))

  const branchPruned = current.branches.filter((branch) => survivingSessionIds.has(branch.sessionId))
  const keepBranchIds = new Set(branchPruned.map((branch) => branch.id))

  const checkpointsForUser = current.checkpoints
    .filter((checkpoint) => {
      const session = survivingSessionById.get(checkpoint.sessionId)
      if (!session) return false
      if (session.userId !== userId) return false
      return keepSessionIds.has(checkpoint.sessionId)
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const keepCheckpointIds = new Set(
    checkpointsForUser.slice(0, MAX_CHECKPOINTS_PER_USER).map((checkpoint) => checkpoint.id),
  )

  const checkpointPruned = current.checkpoints.filter((checkpoint) => {
    const session = survivingSessionById.get(checkpoint.sessionId)
    if (!session) return false
    if (session.userId !== userId) return true
    if (!keepSessionIds.has(checkpoint.sessionId)) return false
    return keepCheckpointIds.has(checkpoint.id)
  })

  const operationPruned = current.operations.filter((operation) => keepBranchIds.has(operation.branchId))

  store = {
    sessions: sessionPruned,
    branches: branchPruned,
    checkpoints: checkpointPruned,
    operations: operationPruned,
  }
}

function assertUserSession(userId: string, sessionId: string): WorkspaceSession {
  const current = requireStore()
  const session = current.sessions.find((entry) => entry.id === sessionId && entry.userId === userId)
  if (!session) {
    throw new Error('Workspace session not found')
  }
  return session
}

function assertBranchInSession(sessionId: string, branchId: string): WorkspaceBranch {
  const current = requireStore()
  const branch = current.branches.find((entry) => entry.id === branchId && entry.sessionId === sessionId)
  if (!branch) {
    throw new Error('Workspace branch not found')
  }
  return branch
}

function assertCheckpointInSession(sessionId: string, checkpointId: string): WorkspaceCheckpoint {
  const current = requireStore()
  const checkpoint = current.checkpoints.find(
    (entry) => entry.id === checkpointId && entry.sessionId === sessionId,
  )
  if (!checkpoint) {
    throw new Error('Workspace checkpoint not found')
  }
  return checkpoint
}

export async function listWorkspaceSessions(userId: string): Promise<ReadonlyArray<WorkspaceSession>> {
  await ensureLoaded()
  const current = requireStore()
  return current.sessions
    .filter((session) => session.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function createWorkspaceSession(
  userId: string,
  request: CreateWorkspaceSessionRequest,
): Promise<WorkspaceSessionBundle> {
  await ensureLoaded()
  const current = requireStore()
  const timestamp = nowIso()

  const session: WorkspaceSession = {
    id: randomUUID(),
    userId,
    scope: request.scope,
    signalId: request.signalId ?? null,
    title: defaultTitle(request),
    activeBranchId: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    status: 'active',
  }

  const branch: WorkspaceBranch = {
    id: randomUUID(),
    sessionId: session.id,
    name: 'Main',
    parentCheckpointId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  const checkpoint: WorkspaceCheckpoint = {
    id: randomUUID(),
    sessionId: session.id,
    branchId: branch.id,
    label: 'Initial',
    createdAt: timestamp,
    snapshot: request.initialSnapshot ?? EMPTY_SNAPSHOT,
  }

  const normalizedSession = WorkspaceSessionSchema.parse({ ...session, activeBranchId: branch.id })
  const normalizedBranch = WorkspaceBranchSchema.parse(branch)
  const normalizedCheckpoint = WorkspaceCheckpointSchema.parse(checkpoint)

  store = {
    sessions: [...current.sessions, normalizedSession],
    branches: [...current.branches, normalizedBranch],
    checkpoints: [...current.checkpoints, normalizedCheckpoint],
    operations: current.operations,
  }

  pruneUserRetention(userId)
  await persist()

  const bundle = {
    session: normalizedSession,
    branches: [normalizedBranch],
    checkpoints: [normalizedCheckpoint],
  }

  return WorkspaceSessionBundleSchema.parse(bundle)
}

export async function getWorkspaceSessionBundle(userId: string, sessionId: string): Promise<WorkspaceSessionBundle> {
  await ensureLoaded()
  const session = assertUserSession(userId, sessionId)
  const current = requireStore()

  const branches = current.branches
    .filter((branch) => branch.sessionId === session.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const checkpoints = current.checkpoints
    .filter((checkpoint) => checkpoint.sessionId === session.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return WorkspaceSessionBundleSchema.parse({ session, branches, checkpoints })
}

export async function updateWorkspaceSession(
  userId: string,
  sessionId: string,
  request: UpdateWorkspaceSessionRequest,
): Promise<WorkspaceSession> {
  await ensureLoaded()
  const session = assertUserSession(userId, sessionId)
  const current = requireStore()
  const updatedAt = nowIso()

  const next: WorkspaceSession = WorkspaceSessionSchema.parse({
    ...session,
    ...request,
    updatedAt,
  })

  store = {
    sessions: current.sessions.map((entry) => (entry.id === sessionId ? next : entry)),
    branches: current.branches,
    checkpoints: current.checkpoints,
    operations: current.operations,
  }

  await persist()
  return next
}

export async function createWorkspaceBranch(
  userId: string,
  sessionId: string,
  request: CreateWorkspaceBranchRequest,
): Promise<WorkspaceBranch> {
  await ensureLoaded()
  assertUserSession(userId, sessionId)
  const current = requireStore()
  const timestamp = nowIso()

  if (request.parentCheckpointId) {
    assertCheckpointInSession(sessionId, request.parentCheckpointId)
  }

  const branch: WorkspaceBranch = WorkspaceBranchSchema.parse({
    id: randomUUID(),
    sessionId,
    name: request.name,
    parentCheckpointId: request.parentCheckpointId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  store = {
    sessions: current.sessions,
    branches: [...current.branches, branch],
    checkpoints: current.checkpoints,
    operations: current.operations,
  }

  await persist()
  return branch
}

export async function updateWorkspaceBranch(
  userId: string,
  sessionId: string,
  branchId: string,
  request: UpdateWorkspaceBranchRequest,
): Promise<WorkspaceBranch> {
  await ensureLoaded()
  assertUserSession(userId, sessionId)
  const branch = assertBranchInSession(sessionId, branchId)
  const current = requireStore()

  const next = WorkspaceBranchSchema.parse({
    ...branch,
    ...request,
    updatedAt: nowIso(),
  })

  store = {
    sessions: current.sessions,
    branches: current.branches.map((entry) => (entry.id === branchId ? next : entry)),
    checkpoints: current.checkpoints,
    operations: current.operations,
  }

  await persist()
  return next
}

export async function createWorkspaceCheckpoint(
  userId: string,
  sessionId: string,
  request: CreateWorkspaceCheckpointRequest,
): Promise<WorkspaceCheckpoint> {
  await ensureLoaded()
  assertUserSession(userId, sessionId)
  assertBranchInSession(sessionId, request.branchId)
  const current = requireStore()

  const checkpoint = WorkspaceCheckpointSchema.parse({
    id: randomUUID(),
    sessionId,
    branchId: request.branchId,
    label: request.label ?? null,
    createdAt: nowIso(),
    snapshot: request.snapshot,
  })

  store = {
    sessions: current.sessions,
    branches: current.branches,
    checkpoints: [...current.checkpoints, checkpoint],
    operations: current.operations,
  }

  pruneUserRetention(userId)
  await persist()
  return checkpoint
}

export async function restoreWorkspaceCheckpoint(
  userId: string,
  sessionId: string,
  checkpointId: string,
): Promise<WorkspaceCheckpoint> {
  await ensureLoaded()
  const session = assertUserSession(userId, sessionId)
  const checkpoint = assertCheckpointInSession(sessionId, checkpointId)
  const current = requireStore()
  const timestamp = nowIso()

  const restoredCheckpoint = WorkspaceCheckpointSchema.parse({
    id: randomUUID(),
    sessionId,
    branchId: checkpoint.branchId,
    label: checkpoint.label ? `Restore: ${checkpoint.label}` : 'Restore',
    createdAt: timestamp,
    snapshot: checkpoint.snapshot,
  })

  const updatedSession = WorkspaceSessionSchema.parse({
    ...session,
    activeBranchId: restoredCheckpoint.branchId,
    updatedAt: timestamp,
  })

  store = {
    sessions: current.sessions.map((entry) => (entry.id === sessionId ? updatedSession : entry)),
    branches: current.branches,
    checkpoints: [...current.checkpoints, restoredCheckpoint],
    operations: current.operations,
  }

  pruneUserRetention(userId)
  await persist()
  return restoredCheckpoint
}

export async function compareWorkspaceBranches(
  userId: string,
  sessionId: string,
  leftBranchId: string,
  rightBranchId: string,
): Promise<WorkspaceBranchCompare> {
  await ensureLoaded()
  assertUserSession(userId, sessionId)
  assertBranchInSession(sessionId, leftBranchId)
  assertBranchInSession(sessionId, rightBranchId)
  const current = requireStore()

  const left = latestCheckpoint(current.checkpoints, leftBranchId)
  const right = latestCheckpoint(current.checkpoints, rightBranchId)

  if (!left || !right) {
    throw new Error('Cannot compare branches without checkpoints')
  }

  const leftEval = left.snapshot.evaluation ?? null
  const rightEval = right.snapshot.evaluation ?? null

  const result = WorkspaceBranchCompareSchema.parse({
    leftBranchId,
    rightBranchId,
    leftCheckpointId: left.id,
    rightCheckpointId: right.id,
    metrics: {
      scoreDelta: (rightEval?.score ?? 0) - (leftEval?.score ?? 0),
      turnoverDelta: (rightEval?.turnoverPct ?? 0) - (leftEval?.turnoverPct ?? 0),
      downsideReductionDeltaCad:
        (rightEval?.downsideReductionCad ?? 0) - (leftEval?.downsideReductionCad ?? 0),
      nodeDelta: nodeCountFromSnapshot(right.snapshot) - nodeCountFromSnapshot(left.snapshot),
      edgeDelta: edgeCountFromSnapshot(right.snapshot) - edgeCountFromSnapshot(left.snapshot),
    },
  })

  return result
}

export async function appendWorkspaceOperation(
  userId: string,
  sessionId: string,
  operation: Omit<WorkspaceOperation, 'id' | 'sessionId' | 'at'>,
  snapshot?: WorkspaceSnapshot,
): Promise<WorkspaceOperation> {
  await ensureLoaded()
  const session = assertUserSession(userId, sessionId)
  assertBranchInSession(sessionId, operation.branchId)
  const current = requireStore()

  const nextOperation = WorkspaceOperationSchema.parse({
    id: randomUUID(),
    sessionId,
    branchId: operation.branchId,
    type: operation.type,
    payload: operation.payload,
    actor: operation.actor,
    at: nowIso(),
  })

  const nextOperations = [...current.operations, nextOperation]
  let nextCheckpoints = current.checkpoints
  if (snapshot) {
    const autosave = WorkspaceCheckpointSchema.parse({
      id: randomUUID(),
      sessionId,
      branchId: operation.branchId,
      label: null,
      createdAt: nowIso(),
      snapshot,
    })
    nextCheckpoints = [...nextCheckpoints, autosave]
  }

  const updatedSession = WorkspaceSessionSchema.parse({
    ...session,
    activeBranchId: operation.branchId,
    updatedAt: nowIso(),
  })

  store = {
    sessions: current.sessions.map((entry) => (entry.id === session.id ? updatedSession : entry)),
    branches: current.branches,
    checkpoints: nextCheckpoints,
    operations: nextOperations,
  }

  pruneUserRetention(userId)
  await persist()
  return nextOperation
}

export function __resetWorkspaceStoreForTests(): void {
  store = null
}
