# Feature: GCP Deployment

**ID:** 20
**Status:** ⬜ Not Started
**Priority:** Low
**Estimated Complexity:** High
**Dependencies:** 17 (Server API Endpoints), 21 (Final Codebase Cleanup)
**Tier:** 10

## Description

Deploy the complete system to GCP Cloud Run with Firestore for persistent state, Redis (Memorystore) for hot cache, and Secret Manager for API keys. Region: northamerica-northeast1 (Montreal).

## Acceptance Criteria

- [ ] API server deployed to Cloud Run (auto-scaling, min 1 instance)
- [ ] Frontend deployed as static site (Cloud Run or GCS + CDN)
- [ ] Firestore collections created: users, portfolios, sessions, verdicts, briefs
- [ ] Sample data migrated from JSON files to Firestore
- [ ] Redis hot cache for signal verdicts (30-min TTL)
- [ ] API keys in Secret Manager
- [ ] SSE streaming works on Cloud Run
- [ ] Full pipeline runs correctly on deployed instance
- [ ] Deployment URL shareable with recruiter

## Files to Create

- `Dockerfile` - API server container
- `Dockerfile.frontend` - Frontend build container
- `docker-compose.yml` - Local dev setup
- `deploy/cloud-run.yaml` - Cloud Run service config
- `deploy/setup-firestore.ts` - Firestore collection setup script
- `deploy/migrate-data.ts` - JSON → Firestore migration script
- `agents/src/multi-agent/cache-redis.ts` - RedisCacheStore implementation
- `agents/src/multi-agent/cache-firestore.ts` - FirestoreCacheStore implementation

## Implementation Details

### Cloud Run Configuration

```yaml
service:
  name: prism-api
  region: northamerica-northeast1
  scaling:
    minInstances: 1
    maxInstances: 10
    concurrency: 80
  resources:
    cpu: 2
    memory: 1Gi
  timeout: 300s
```

### Firestore Collections

| Collection | Documents | TTL |
|-----------|-----------|-----|
| `users/{userId}` | UserProfile + expectations | Permanent |
| `portfolios/{userId}` | Portfolio data | Permanent |
| `sessions/{userId}/{sessionId}` | Chat messages + state | 30 days |
| `verdicts/{signalId}` | FundManagerVerdict | 30 min |
| `briefs/{signalId}` | ResearchBrief | 30 min |

### Environment Variables (Secret Manager)

- `GEMINI_API_KEY`
- `LANGSMITH_API_KEY`
- `REDIS_URL`
- `FIRESTORE_PROJECT` (bigquery-etl-488322)

### Dockerfiles

API Server:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY agents/ agents/
COPY shared/ shared/
COPY server/ server/
COPY data/ data/
RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm build
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
```

Frontend:
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN npm install -g pnpm && pnpm install && pnpm --filter @prism/frontend build

FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
```

## Implementation Checklist

- [ ] Create Dockerfiles
- [ ] Create docker-compose.yml for local testing
- [ ] Implement RedisCacheStore
- [ ] Implement FirestoreCacheStore
- [ ] Create Firestore setup script
- [ ] Create data migration script
- [ ] Configure Secret Manager
- [ ] Deploy API to Cloud Run
- [ ] Deploy frontend
- [ ] Test full flow on deployed instance
- [ ] Share URL
