# Feature: Server API Endpoints

**ID:** 17
**Status:** ⬜ Not Started
**Priority:** High
**Estimated Complexity:** Medium
**Dependencies:** 13 (Pipeline Orchestrator), 15 (Chat UI Layout)
**Tier:** 7

## Description

Wire the multi-agent pipeline into Express server endpoints with SSE streaming for progressive chat card delivery. Replace old orchestrator entry point.

## Acceptance Criteria

- [ ] `POST /api/analyze` — triggers single-signal pipeline, returns SSE stream
- [ ] `POST /api/analyze/portfolio` — triggers portfolio review mode, returns SSE stream
- [ ] `POST /api/analyze/:threadId/resume` — resumes pipeline after checkpoint with user input
- [ ] `POST /api/chat` — chat message endpoint for follow-up queries
- [ ] SSE streams progressive events: analyst_complete, debate_complete, checkpoint, stress_complete, verdict, brief
- [ ] Old causal chain endpoints removed or deprecated
- [ ] Cache layer abstracted behind CacheStore interface
- [ ] Session state persisted (in-memory for prototype, Redis-ready interface)

## Files to Create/Modify

- `server/src/routes/analyze.ts` - Pipeline invocation endpoints
- `server/src/routes/chat.ts` - Chat and follow-up endpoints (update existing)
- `agents/src/multi-agent/cache.ts` - CacheStore interface + InMemoryStore
- `server/src/routes/sessions.ts` - Session CRUD

## Implementation Details

### SSE Streaming for Pipeline Progress

```typescript
// POST /api/analyze
router.post('/analyze', async (req, res) => {
  const { signalId, portfolioId, userId } = req.body

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const result = await runMultiAgentAnalysis({
    signal, portfolio, userProfile, exposureMap,
    onProgress: (stage, data) => {
      res.write(`event: ${stage}\ndata: ${JSON.stringify(data)}\n\n`)
    },
  })

  res.write(`event: complete\ndata: ${JSON.stringify(result)}\n\n`)
  res.end()
})
```

### SSE Event Types

| Event | Data | When |
|-------|------|------|
| `risk_profile` | InferredRiskProfile | After risk inference |
| `analyst_complete` | AnalystAssessment | Per analyst (4 times) |
| `debate_round` | DebateArgument | Per debate round |
| `debate_complete` | DebateResolution | After debate resolves |
| `checkpoint_debate` | DebateResolution | Checkpoint 1 — pauses for input |
| `risk_challenge` | RiskChallenge | After assumptions challenger |
| `magnitude_validation` | MagnitudeValidation | After magnitude validator |
| `stress_complete` | StressTestResult | After stress tester |
| `checkpoint_stress` | StressTestResult | Checkpoint 2 — pauses for input |
| `verdict` | FundManagerVerdict | After fund manager |
| `judge` | JudgeVerdict | After judge |
| `brief` | ResearchBrief | After brief generation |
| `complete` | Full result object | Pipeline finished |

### Checkpoint Resume

```typescript
// POST /api/analyze/:threadId/resume
router.post('/analyze/:threadId/resume', async (req, res) => {
  const { threadId } = req.params
  const { humanInput } = req.body
  // { type: 'debate_correction', value: string } or
  // { type: 'scenario_preference', value: 'base'|'downside'|'tail' }

  // Resume LangGraph from checkpoint
  // Continue SSE streaming
})
```

### CacheStore Interface

```typescript
// agents/src/multi-agent/cache.ts
interface CacheStore {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlMs: number): Promise<void>
  delete(key: string): Promise<void>
}

class InMemoryCacheStore implements CacheStore {
  private store = new Map<string, { value: unknown; expiresAt: number }>()
  // ... implementation
}

// Future: RedisCacheStore, FirestoreCacheStore
```

### Session Management

```typescript
// POST /api/sessions — create new session
// GET /api/sessions/:userId — list user sessions
// GET /api/sessions/:sessionId — get session with messages
// DELETE /api/sessions/:sessionId — delete session
```

## Testing Requirements

- [ ] SSE stream delivers events in correct order
- [ ] Checkpoint pause/resume works correctly
- [ ] Cache stores and retrieves verdicts
- [ ] Session CRUD operations work

## Implementation Checklist

- [ ] Implement CacheStore interface + InMemoryStore
- [ ] Create analyze routes with SSE streaming
- [ ] Implement checkpoint resume endpoint
- [ ] Create session CRUD endpoints
- [ ] Wire into server/src/index.ts
- [ ] Write integration tests
- [ ] Remove old causal chain endpoints
