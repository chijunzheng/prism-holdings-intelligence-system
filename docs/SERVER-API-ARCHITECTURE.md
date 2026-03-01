# Server API Architecture: Endpoints & SSE Streaming

**Status:** Production Ready
**Framework:** Express.js on port 3001
**Communication:** SSE (Server-Sent Events) for streaming, REST for state management
**Key Pattern:** Stateless endpoints with optional checkpoint persistence via threadId

---

## Overview

Prism's server exposes RESTful endpoints for:
1. **Analysis execution** — run multi-agent pipeline with SSE streaming
2. **Session management** — CRUD for analysis conversations
3. **Portfolio data** — holdings, exposure decomposition, risk profile
4. **Checkpoint resumption** — handle human-in-the-loop pauses

The server is **completely stateless except for thread context** during checkpoints. After a checkpoint, the frontend resumes by sending user input; the server reconstructs the pipeline state and continues.

---

## Core Analysis Endpoints

### POST /api/v2/analyze — Single-Signal Analysis (SSE Streaming)

**Purpose:** Run the full multi-agent pipeline on a signal and stream results in real-time

**Request:**
```json
{
  "userId": "user-123",
  "signal": {
    "id": "signal-rate-hike-2024",
    "headline": "Federal Reserve raises rates 25bps",
    "description": "FOMC decision...",
    "affectedExposures": ["equities", "bonds", "currencies"],
    "relevanceScore": 0.95,
    "urgency": "high",
    "sentiment": "negative",
    "temporalClassification": "structural",
    "sources": [
      { "title": "Reuters: Fed raises rates", "url": "..." }
    ],
    "detectedAt": "2024-03-20T14:30:00Z",
    "acknowledged": false
  },
  "pipelineMode": "guided",  // "quick" or "guided"; optional
  "skipCheckpoints": false    // only for backward compatibility
}
```

**Response Type:** Server-Sent Events (text/event-stream)

**Events Emitted:**
```
event: progress
data: { stage: "risk_profile", status: "active", ... }

event: agent_thinking
data: { stage: "analyst_complete", text: "macro analyst: evaluating..." }

event: checkpoint
data: { stage: "debate_resolution", debateResolution: {...}, ... }

event: thread_id
data: { threadId: "analysis-signal-123-1709469600000" }

event: impact_delta
data: { signalId, summary, netImpactMidCad, affectedHoldings: [...] }

event: playbook
data: { title, rationale, estimatedCost, riskReduction, tradeoffs, steps, alternatives }

event: trace_step
data: { stageId, stageLabel, summary }

event: complete
data: { verdict, researchBrief, intermediateArtifacts }

event: error
data: { message: "Pipeline failed..." }
```

**Behavior:**

| Mode | Behavior |
|------|----------|
| `quick` | Runs end-to-end without pauses. Returns complete event with full verdict. |
| `guided` | Pauses at checkpoints (debate, stress test). Returns checkpoint event + threadId. |

**Caching:**
- Quick mode: Caches verdict + brief for 24h. Repeat analyses return cached result immediately.
- Guided mode: Skips cache (user wants interactive flow).

**Error Handling:**
- Sends `error` event on pipeline failure
- Connection closes via `res.end()`

---

### POST /api/v2/analyze/{threadId}/resume — Resume After Checkpoint

**Purpose:** Resume a paused pipeline with human input (e.g., corrected assumption)

**When Used:**
- After Checkpoint 1 (user corrects debate outcome)
- After Checkpoint 2 (user selects risk scenario)

**Request:**
```json
{
  "humanInput": "Actually, oil more likely flat or up +2%",
  "inputType": "debate_correction"  // "debate_correction" | "scenario_preference"
}
```

**Input Types:**

| Type | Value | Example |
|------|-------|---------|
| `debate_correction` | string | "Agree, but OPEC meeting signals cuts. Assume +2% oil." |
| `scenario_preference` | string | "base" \| "downside" \| "tail" |

**Response:** Server-Sent Events (continues streaming from checkpoint)

**Data Flow:**
```
1. Frontend paused at checkpoint with threadId
2. User provides input (text correction or scenario button click)
3. Frontend sends POST /api/v2/analyze/{threadId}/resume
4. Server looks up signal + userId from threadContextMap[threadId]
5. Server reconstructs pipeline state at checkpoint
6. LangGraph resumes from interrupt point with human input
7. Server streams remaining events (progress, complete)
```

**Thread Context Storage:**
```typescript
threadContextMap: Map<string, { signal, userId }>
// Stores just enough to resume: signal definition + user identification
// Garbage collected when pipeline completes or times out (optional: 10min TTL)
```

---

### POST /api/v2/analyze/portfolio — Portfolio Review Mode

**Purpose:** Synthesize multiple signals into portfolio-level verdict

**Request:**
```json
{
  "userId": "user-123",
  "signals": [
    { /* signal 1 */ },
    { /* signal 2 */ },
    { /* signal 3 */ }
  ]
}
```

**Behavior:**
1. **Input validation** — verify all signals + user exist
2. **Parallel analysis** — run multiagent pipeline on each signal in parallel
3. **Synthesis** — aggregate verdicts into PortfolioVerdict with cross-signal interaction analysis
4. **Streaming** — same SSE pattern as single-signal analysis

**Response Events:**
- Same as single-signal, but final event is:
  ```
  event: portfolio_complete
  data: {
    signals: [...individual verdicts],
    holdingNetImpacts: [...per-holding with interaction classification],
    portfolioNetImpact: { low, mid, high },
    portfolioGrossImpact: { low, mid, high },
    keyInsights: [...LLM-generated],
    recommendations: [...holistic portfolio recommendations],
    interactionSummary: "3 signals, 1 offsetting, 1 compounding..."
  }
  ```

---

## Session Management Endpoints

Sessions are **optional** for basic analysis. They store chat conversation history with verdict snapshots. Useful for replaying analysis or building on previous insights.

### GET /api/v2/sessions/{userId}

**Purpose:** List all analysis sessions for user

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "session-123",
      "type": "signal",
      "title": "Fed Rate Hike Impact",
      "signalId": "signal-rate-123",
      "status": "complete",
      "messageCount": 15,
      "createdAt": "2024-03-20T14:30:00Z",
      "updatedAt": "2024-03-20T14:35:00Z"
    }
  ]
}
```

---

### POST /api/v2/sessions/{userId}

**Purpose:** Create new session

**Request:**
```json
{
  "type": "signal",  // "signal" | "portfolio_review" | "holding" | "general"
  "title": "Fed Rate Hike Impact",
  "signalId": "signal-rate-123"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "session-123",
    "userId": "user-123",
    "type": "signal",
    "title": "Fed Rate Hike Impact",
    "status": "pending",
    "messages": [],
    "createdAt": "2024-03-20T14:30:00Z"
  }
}
```

---

### GET /api/v2/sessions/{userId}/{sessionId}

**Purpose:** Retrieve full session with all messages

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "session-123",
    "messages": [
      {
        "id": "msg-1",
        "role": "assistant",
        "content": "...",
        "cardType": "signal",
        "cardData": {...},
        "timestamp": "..."
      },
      ...
    ],
    "cachedVerdict": {...},
    "cachedBrief": {...},
    "checkpointStage": "debate_resolution",
    ...
  }
}
```

---

### POST /api/v2/sessions/{userId}/{sessionId}/messages

**Purpose:** Add message to session (for building chat history)

**Request:**
```json
{
  "role": "user",
  "content": "Analyze the rate hike impact",
  "cardType": "thinking",
  "cardData": { /* optional rich data */ }
}
```

---

## Portfolio & Data Endpoints

### GET /api/portfolio/{userId}

**Purpose:** Get user's portfolio (holdings + allocations)

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user-123",
    "totalValueCad": 50000,
    "holdings": [
      {
        "ticker": "VFV",
        "name": "Vanguard U.S. Total Market...",
        "quantity": 100,
        "currentPriceCad": 250,
        "valueCad": 25000,
        "allocationPercent": 50
      },
      ...
    ],
    "riskProfile": {
      "riskTolerance": "moderate",
      "riskScore": 60,
      "timeHorizon": "10 years"
    }
  }
}
```

---

### GET /api/exposure/{userId}

**Purpose:** Get exposure decomposition (holdings → underlying assets)

**Response:**
```json
{
  "success": true,
  "data": {
    "exposureMap": {
      "VFV": {
        "fundName": "Vanguard U.S. Total Market",
        "holdings": [
          {
            "ticker": "MSFT",
            "name": "Microsoft",
            "weight": 0.025,
            "sector": "Information Technology",
            "exposure": 625  // 625 CAD of VFV's 25k is MSFT
          },
          ...
        ]
      },
      ...
    }
  }
}
```

---

### GET /api/signals/{userId}

**Purpose:** Get active signals for user's portfolio

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "signal-rate-123",
      "headline": "Federal Reserve raises rates 25bps",
      "sentiment": "negative",
      "urgency": "high",
      "detectedAt": "2024-03-20T14:30:00Z",
      "acknowledged": false
    },
    ...
  ]
}
```

---

## Stream Processing: How SSE Works

### On Client (Frontend)

```javascript
// 1. Open EventSource connection
const eventSource = new EventSource('/api/v2/analyze?...params...')

// 2. Listen for events
eventSource.addEventListener('progress', (e) => {
  const data = JSON.parse(e.data)
  updateProgressBar(data.stage, data.status)
})

eventSource.addEventListener('agent_thinking', (e) => {
  const { stage, text } = JSON.parse(e.data)
  insertThinkingCard(stage, text)
})

eventSource.addEventListener('checkpoint', (e) => {
  const checkpoint = JSON.parse(e.data)
  showCheckpointCard(checkpoint)
  pauseAnalysis()
})

eventSource.addEventListener('complete', (e) => {
  const { verdict, researchBrief } = JSON.parse(e.data)
  displayVerdictCards(verdict)
  eventSource.close()
})
```

### On Server (Backend)

```typescript
function setupSse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()  // Send headers immediately (TTFR <10ms)
}

function sendSseEvent(res: Response, event: string, data: unknown): void {
  // Format: event: {name}\ndata: {json}\n\n
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

// During pipeline execution:
const outcome = await runMultiAgentAnalysis({
  onProgress: (stage, data) => {
    sendSseEvent(res, stage, data)
  },
  onThinking: (stage, text) => {
    sendSseEvent(res, 'agent_thinking', { stage, text })
  }
})
```

**Timing:**
- Headers sent immediately → <10ms TTFR
- Progress event sent as each stage completes → ~1s per major stage
- Final complete event sent when pipeline finishes → ~6s end-to-end

---

## Checkpoint Flow: Complete Walkthrough

### Scenario: User wants to correct debate assumption before risk team runs

**Step 1: Pipeline reaches Checkpoint 1**
```
Server receives debate outcome:
├─ Bull: Oil falls 15%, VFV negative
├─ Bear: OPEC cuts stabilize oil, VFV neutral
└─ Consensus: Negative, magnitude 0.5

Server sends checkpoint event:
event: checkpoint
data: {
  stage: "debate_resolution",
  debateResolution: {...},
  type: "hard"  // User must decide
}

Server also sends:
event: thread_id
data: { threadId: "analysis-signal-123-1709469600000" }

Server pauses (calls interrupt() in LangGraph)
Frontend shows DebateSummaryCard + CheckpointCard
```

**Step 2: User reviews and corrects**
```
User reads: "Bull says oil down, Bear says flat"
User provides domain knowledge: "Actually, OPEC meeting signals production cuts"
User clicks [Provide Correction] button

Frontend sends:
POST /api/v2/analyze/{threadId}/resume
{
  "humanInput": "OPEC meeting coming — likely cuts production. Oil probably flat or up +2%",
  "inputType": "debate_correction"
}
```

**Step 3: Server resumes with correction**
```
Server retrieves from threadContextMap[threadId]:
├─ signal: { id: "signal-rate-hike", ... }
└─ userId: "user-123"

Server reconstructs pipeline state and LangGraph thread
Server injects humanInput into state: humanCorrectionAtDebate = "OPEC meeting..."

LangGraph continues from interrupt point:
├─ Risk team now uses corrected assumption (+2% oil vs -15%)
├─ Magnitude validator re-runs with new assumption
└─ Stress test re-runs

Server streams remaining events:
event: progress
event: agent_thinking
event: complete
```

**Step 4: Frontend receives completion**
```
Browser receives complete event with revised verdict
Display shows: "VFV impact adjusted based on your correction..."
User can now decide whether to act
```

---

## Error Handling

### Validation Errors (400)
```json
{
  "success": false,
  "error": "Invalid signal: affectedExposures must be a non-empty array"
}
```

### Missing Resources (404)
```json
{
  "success": false,
  "error": "User or portfolio not found"
}
```

### Pipeline Errors (500 + SSE error event)
```
// HTTP response
{ "success": false, "error": "Pipeline failed" }

// Also sent via SSE to streaming client
event: error
data: { message: "Agent call failed: timeout after 30s" }
```

### Checkpoint Timeout
- Soft checkpoints: Auto-continue after 60s
- Hard checkpoints: No timeout (user must respond or manually cancel)
- Optional future: Hard timeout + auto-revert to previous checkpoint

---

## Caching Strategy

### Verdict Cache (24h TTL)
```
Key: `verdict_{signalId}_{userId}`
Value: FundManagerVerdict (full analysis result)
Used: Quick mode (non-interactive) to avoid re-running pipeline
Skipped: Guided mode (user wants interactive flow)
```

### Brief Cache (24h TTL)
```
Key: `brief_{signalId}_{userId}`
Value: ResearchBrief (formatted research document)
Used: Same as verdict cache
```

### Market Data Cache (24h TTL)
```
Key: `market_data_{ticker1}_{ticker2}_...`
Value: { volatility, correlation, prices, ... }
Used: Every analysis (avoids repeated Yahoo Finance calls)
Cache hit rate: ~100% for same-day analyses
```

### Implementation
```typescript
const cache = new InMemoryCacheStore()

// Before running pipeline (quick mode only)
const cached = await cache.get(verdictCacheKey(signal.id, userId))
if (cached) return cached

// After pipeline completes
await cache.set(verdictCacheKey(signal.id, userId), verdict, 24 * 3600 * 1000)
```

---

## Rate Limiting & Quotas

### Current Implementation
- No strict rate limiting (honor system)
- Max 50 sessions per user (prevents session bloat)
- Soft checkpoint auto-continue: 60s timeout
- Market data cache: 24h TTL (prevents API spam)

### Future Enhancement
```typescript
// Per-user quotas
├─ 100 analyses per day
├─ 10 concurrent analysis streams
├─ 1000 checkpoint resumptions per day
└─ 5 portfolio reviews per day
```

---

## Observability & Logging

### Server-Side Tracing
```typescript
// Each pipeline execution emits:
├─ startTime: when /api/v2/analyze called
├─ per-stage timings: when each SSE event sent
├─ cacheHit: whether verdict was cached
├─ checkpointStages: if any checkpoints triggered
└─ endTime: when response completed or errored
```

### Frontend Metrics (collected from SSE)
```typescript
├─ TTFR (time-to-first-response): progress event sent
├─ Time to first card: agent_thinking event sent
├─ Total analysis time: complete event sent
└─ Checkpoint interactions: checkpoint + resume events
```

---

## Security Considerations

### Input Validation
- All requests validated against Zod schemas
- Signal object fully validated (no injection vectors)
- userId normalized (no path traversal)

### Auth (Future)
```
Current: Implicit (userId in URL/body)
Future: JWT token + user session validation
├─ Verify userId matches token subject
├─ Check rate limits per-user
└─ Log all analyses for audit trail
```

### Secrets Management
```
API Keys stored in:
├─ GEMINI_API_KEY (env var)
├─ YAHOO_FINANCE_API (env var)
└─ Never logged or returned to client
```

---

## Testing Endpoints

### Manual Testing: Single Signal (Quick Mode)
```bash
curl -X POST http://localhost:3001/api/v2/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-1",
    "signal": {
      "id": "test-signal-1",
      "headline": "Test signal",
      "description": "Test description",
      "affectedExposures": ["equities"],
      "relevanceScore": 0.8,
      "urgency": "high",
      "sentiment": "negative",
      "temporalClassification": "structural",
      "sources": [],
      "detectedAt": "2024-03-20T14:00:00Z",
      "acknowledged": false
    },
    "pipelineMode": "quick"
  }'
```

### Manual Testing: Guided Mode with Checkpoint
```bash
# Start analysis in guided mode
curl -X POST http://localhost:3001/api/v2/analyze \
  -d '{ ..., "pipelineMode": "guided" }' &
ANALYSIS_PID=$!

# Wait for checkpoint event + threadId from logs
sleep 3

# Resume with human input
curl -X POST http://localhost:3001/api/v2/analyze/{threadId}/resume \
  -d '{
    "humanInput": "Actually, OPEC likely to cut",
    "inputType": "debate_correction"
  }'
```

---

## References

### Related Documentation
- [Multi-Agent Pipeline Architecture](./MULTI-AGENT-PIPELINE-ARCHITECTURE.md) — Understanding what pipeline endpoints trigger
- [Single Chat Interface UI](./SINGLE-CHAT-INTERFACE-UI.md) — How frontend consumes SSE streams
- [Human-In-The-Loop Checkpoints](./HUMAN-IN-THE-LOOP-CHECKPOINTS.md) — Checkpoint protocol details

### Specifications
- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Express.js](https://expressjs.com/)
- [Zod Validation](https://zod.dev/)

---

**Last Updated:** 2026-03-01
**Status:** Production Ready (Phase 10)
