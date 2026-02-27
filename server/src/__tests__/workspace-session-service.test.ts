import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import type { WorkspaceSnapshot } from '@prism/shared'

async function loadService(storePath: string) {
  process.env.PRISM_WORKSPACE_STORE_PATH = storePath
  vi.resetModules()
  return import('../workspace-session-service')
}

function buildSnapshot(score: number): WorkspaceSnapshot {
  return {
    graphLayers: [],
    scenario: { items: [] },
    evaluation: {
      generatedAt: new Date().toISOString(),
      objective: 'minimize_one_month_downside_with_six_month_guardrail',
      baselineOneMonthCad: -500,
      proposedOneMonthCad: -420,
      baselineSixMonthCad: -250,
      proposedSixMonthCad: -220,
      downsideReductionCad: 80,
      sixMonthGuardrailDeltaCad: 30,
      diversificationGain: 1.2,
      turnoverPct: 2.2,
      turnoverCapPct: 5,
      taxPenaltyCad: 8,
      score,
      objectiveSatisfied: true,
      warnings: [],
      humanDecisionRequired: true,
    },
    selectedSignalId: 'sig-1',
    selectedNodeId: null,
  }
}

describe('workspace-session-service', () => {
  const tmpDirs: string[] = []

  afterEach(async () => {
    delete process.env.PRISM_WORKSPACE_STORE_PATH
    for (const dir of tmpDirs.splice(0, tmpDirs.length)) {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('creates and loads workspace session bundles', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'prism-workspace-'))
    tmpDirs.push(dir)

    const svc = await loadService(join(dir, 'sessions.json'))
    const created = await svc.createWorkspaceSession('sarah-01', {
      scope: 'signal',
      signalId: 'sig-001',
      title: 'Oil Scenario',
      initialSnapshot: buildSnapshot(90),
    })

    expect(created.session.userId).toBe('sarah-01')
    expect(created.branches).toHaveLength(1)
    expect(created.checkpoints).toHaveLength(1)

    const sessions = await svc.listWorkspaceSessions('sarah-01')
    expect(sessions).toHaveLength(1)

    const loaded = await svc.getWorkspaceSessionBundle('sarah-01', created.session.id)
    expect(loaded.session.id).toBe(created.session.id)
    expect(loaded.checkpoints[0]?.snapshot.scenario.items).toEqual([])
  })

  it('enforces per-user session retention cap', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'prism-workspace-'))
    tmpDirs.push(dir)

    const svc = await loadService(join(dir, 'sessions.json'))

    const otherUser = await svc.createWorkspaceSession('mike-01', {
      scope: 'signal',
      signalId: 'sig-other',
      title: 'Other User Session',
      initialSnapshot: buildSnapshot(77),
    })

    for (let index = 0; index < 55; index += 1) {
      await svc.createWorkspaceSession('sarah-01', {
        scope: 'signal',
        signalId: `sig-${index}`,
        title: `Session ${index}`,
        initialSnapshot: buildSnapshot(60 + index),
      })
    }

    const sessions = await svc.listWorkspaceSessions('sarah-01')
    expect(sessions.length).toBeLessThanOrEqual(50)

    const otherSessions = await svc.listWorkspaceSessions('mike-01')
    expect(otherSessions).toHaveLength(1)

    const otherBundle = await svc.getWorkspaceSessionBundle('mike-01', otherUser.session.id)
    expect(otherBundle.branches).toHaveLength(1)
    expect(otherBundle.checkpoints).toHaveLength(1)
  })

  it('compares two branches by latest checkpoint metrics', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'prism-workspace-'))
    tmpDirs.push(dir)

    const svc = await loadService(join(dir, 'sessions.json'))
    const created = await svc.createWorkspaceSession('sarah-01', {
      scope: 'signal',
      signalId: 'sig-compare',
      title: 'Compare Session',
      initialSnapshot: buildSnapshot(72),
    })

    const baseBranch = created.branches[0]
    expect(baseBranch).toBeDefined()

    const altBranch = await svc.createWorkspaceBranch('sarah-01', created.session.id, {
      name: 'Alt',
      parentCheckpointId: created.checkpoints[0]?.id,
    })

    await svc.createWorkspaceCheckpoint('sarah-01', created.session.id, {
      branchId: baseBranch.id,
      label: 'Main CP',
      snapshot: buildSnapshot(75),
    })

    await svc.createWorkspaceCheckpoint('sarah-01', created.session.id, {
      branchId: altBranch.id,
      label: 'Alt CP',
      snapshot: buildSnapshot(98),
    })

    const compare = await svc.compareWorkspaceBranches(
      'sarah-01',
      created.session.id,
      baseBranch.id,
      altBranch.id,
    )

    expect(compare.metrics.scoreDelta).toBeGreaterThan(0)
  })

  it('restores a checkpoint by creating a new latest restore checkpoint', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'prism-workspace-'))
    tmpDirs.push(dir)

    const svc = await loadService(join(dir, 'sessions.json'))
    const created = await svc.createWorkspaceSession('sarah-01', {
      scope: 'signal',
      signalId: 'sig-restore',
      title: 'Restore Session',
      initialSnapshot: buildSnapshot(71),
    })

    const branch = created.branches[0]
    expect(branch).toBeDefined()

    const older = await svc.createWorkspaceCheckpoint('sarah-01', created.session.id, {
      branchId: branch.id,
      label: 'Older',
      snapshot: buildSnapshot(80),
    })

    await svc.createWorkspaceCheckpoint('sarah-01', created.session.id, {
      branchId: branch.id,
      label: 'Latest',
      snapshot: buildSnapshot(95),
    })

    const restored = await svc.restoreWorkspaceCheckpoint('sarah-01', created.session.id, older.id)

    expect(restored.label).toContain('Restore')
    expect(restored.snapshot.evaluation?.score).toBe(80)

    const bundle = await svc.getWorkspaceSessionBundle('sarah-01', created.session.id)
    expect(bundle.session.activeBranchId).toBe(branch.id)
    expect(bundle.checkpoints.some((checkpoint) => checkpoint.id === restored.id)).toBe(true)
    const restoredFromBundle = bundle.checkpoints.find((checkpoint) => checkpoint.id === restored.id)
    expect(restoredFromBundle?.snapshot.evaluation?.score).toBe(80)
  })
})
