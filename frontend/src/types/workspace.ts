import type {
  CreateWorkspaceBranchRequest,
  CreateWorkspaceCheckpointRequest,
  CreateWorkspaceSessionRequest,
  UpdateWorkspaceBranchRequest,
  UpdateWorkspaceSessionRequest,
  WorkspaceBranch,
  WorkspaceBranchCompare,
  WorkspaceCheckpoint,
  WorkspaceOperation,
  WorkspaceSession,
  WorkspaceSessionBundle,
  WorkspaceSnapshot,
} from '@prism/shared/types/workspace'

export type {
  CreateWorkspaceBranchRequest,
  CreateWorkspaceCheckpointRequest,
  CreateWorkspaceSessionRequest,
  UpdateWorkspaceBranchRequest,
  UpdateWorkspaceSessionRequest,
  WorkspaceBranch,
  WorkspaceBranchCompare,
  WorkspaceCheckpoint,
  WorkspaceOperation,
  WorkspaceSession,
  WorkspaceSessionBundle,
  WorkspaceSnapshot,
}

export interface WorkspaceEnvelope<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: string
}
