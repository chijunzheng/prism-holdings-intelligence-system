import { z } from 'zod'
import { CausalChainSchema } from './causal-chain'
import { StrategyEvaluationSchema, StrategyScenarioSchema } from './strategy'

export const WorkspaceScopeSchema = z.enum(['signal', 'portfolio'])
export type WorkspaceScope = z.infer<typeof WorkspaceScopeSchema>

export const WorkspaceGraphLayerKindSchema = z.enum(['impact', 'mitigation'])
export type WorkspaceGraphLayerKind = z.infer<typeof WorkspaceGraphLayerKindSchema>

export const WorkspaceViewportSchema = z.object({
  panX: z.number(),
  panY: z.number(),
  scale: z.number().min(0.1).max(8),
})
export type WorkspaceViewport = z.infer<typeof WorkspaceViewportSchema>

export const WorkspaceGraphLayerSchema = z.object({
  id: z.string(),
  kind: WorkspaceGraphLayerKindSchema,
  chain: CausalChainSchema,
  sourceSignalId: z.string().nullable().optional(),
})
export type WorkspaceGraphLayer = z.infer<typeof WorkspaceGraphLayerSchema>

export const WorkspaceSnapshotSchema = z.object({
  graphLayers: z.array(WorkspaceGraphLayerSchema).readonly(),
  scenario: StrategyScenarioSchema,
  evaluation: StrategyEvaluationSchema.nullable().optional(),
  selectedSignalId: z.string().nullable().optional(),
  selectedNodeId: z.string().nullable().optional(),
  viewport: WorkspaceViewportSchema.optional(),
})
export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshotSchema>

export const WorkspaceSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  scope: WorkspaceScopeSchema,
  signalId: z.string().nullable(),
  title: z.string(),
  activeBranchId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: z.enum(['active', 'archived']).default('active'),
})
export type WorkspaceSession = z.infer<typeof WorkspaceSessionSchema>

export const WorkspaceBranchSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  name: z.string(),
  parentCheckpointId: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type WorkspaceBranch = z.infer<typeof WorkspaceBranchSchema>

export const WorkspaceCheckpointSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  branchId: z.string(),
  label: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  snapshot: WorkspaceSnapshotSchema,
})
export type WorkspaceCheckpoint = z.infer<typeof WorkspaceCheckpointSchema>

export const WorkspaceOperationSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  branchId: z.string(),
  type: z.enum([
    'select_signal',
    'add_candidate',
    'remove_candidate',
    'set_allocation',
    'evaluate',
    'chat_proposal',
    'expand_node',
    'create_branch',
    'restore_checkpoint',
  ]),
  payload: z.record(z.unknown()).default({}),
  actor: z.enum(['human', 'assistant']).default('human'),
  at: z.string().datetime(),
})
export type WorkspaceOperation = z.infer<typeof WorkspaceOperationSchema>

export const WorkspaceSessionBundleSchema = z.object({
  session: WorkspaceSessionSchema,
  branches: z.array(WorkspaceBranchSchema).readonly(),
  checkpoints: z.array(WorkspaceCheckpointSchema).readonly(),
})
export type WorkspaceSessionBundle = z.infer<typeof WorkspaceSessionBundleSchema>

export const CreateWorkspaceSessionRequestSchema = z.object({
  scope: WorkspaceScopeSchema,
  signalId: z.string().optional(),
  title: z.string().min(1).max(120).optional(),
  initialSnapshot: WorkspaceSnapshotSchema.optional(),
})
export type CreateWorkspaceSessionRequest = z.infer<typeof CreateWorkspaceSessionRequestSchema>

export const CreateWorkspaceBranchRequestSchema = z.object({
  name: z.string().min(1).max(80),
  parentCheckpointId: z.string().optional(),
})
export type CreateWorkspaceBranchRequest = z.infer<typeof CreateWorkspaceBranchRequestSchema>

export const CreateWorkspaceCheckpointRequestSchema = z.object({
  branchId: z.string(),
  label: z.string().max(120).optional(),
  snapshot: WorkspaceSnapshotSchema,
})
export type CreateWorkspaceCheckpointRequest = z.infer<typeof CreateWorkspaceCheckpointRequestSchema>

export const UpdateWorkspaceSessionRequestSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  status: z.enum(['active', 'archived']).optional(),
  activeBranchId: z.string().optional(),
})
export type UpdateWorkspaceSessionRequest = z.infer<typeof UpdateWorkspaceSessionRequestSchema>

export const UpdateWorkspaceBranchRequestSchema = z.object({
  name: z.string().min(1).max(80).optional(),
})
export type UpdateWorkspaceBranchRequest = z.infer<typeof UpdateWorkspaceBranchRequestSchema>

export const CompareWorkspaceBranchesRequestSchema = z.object({
  leftBranchId: z.string(),
  rightBranchId: z.string(),
})
export type CompareWorkspaceBranchesRequest = z.infer<typeof CompareWorkspaceBranchesRequestSchema>

export const WorkspaceBranchCompareSchema = z.object({
  leftBranchId: z.string(),
  rightBranchId: z.string(),
  leftCheckpointId: z.string(),
  rightCheckpointId: z.string(),
  metrics: z.object({
    scoreDelta: z.number(),
    turnoverDelta: z.number(),
    downsideReductionDeltaCad: z.number(),
    nodeDelta: z.number(),
    edgeDelta: z.number(),
  }),
})
export type WorkspaceBranchCompare = z.infer<typeof WorkspaceBranchCompareSchema>

export const WorkspaceOperationAppendRequestSchema = z.object({
  branchId: z.string(),
  type: WorkspaceOperationSchema.shape.type,
  payload: z.record(z.unknown()).optional(),
  actor: WorkspaceOperationSchema.shape.actor.optional(),
  snapshot: WorkspaceSnapshotSchema.optional(),
})
export type WorkspaceOperationAppendRequest = z.infer<typeof WorkspaceOperationAppendRequestSchema>
