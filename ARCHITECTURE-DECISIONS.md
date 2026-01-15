# Architecture Decisions

This document tracks key architectural decisions made during the development of the Documentation Orchestration System.

## ADR-001: Vercel Deployment Structure

**Date**: 2026-01-15
**Status**: Implemented
**Decision**: Deploy webhook as serverless API route, separate future web UI

### Context

The system has two distinct components with different purposes:
1. **Webhook Endpoint** - Receives Featurebase changelog webhooks (already built)
2. **Web UI** - Editor interface for reviewing and approving AI suggestions (future)

We needed to decide:
- Should they be in the same Vercel deployment?
- Should the root URL serve anything?
- How should they be structured?

### Decision

**Current State (Phase 1):**
- Root URL (`https://doc-orchestration-system.vercel.app`) → 404 (expected)
- Webhook endpoint (`/api/webhooks/changelog`) → Active, POST-only
- No web UI yet

**Rationale:**
1. **Separation of Concerns**: The webhook is a backend service that doesn't need a frontend
2. **Security**: No unnecessary public-facing pages reduces attack surface
3. **Clear Intent**: 404 on root makes it clear this is an API-only deployment
4. **Future Flexibility**: We can add Next.js pages later without restructuring

**Future State (Phase 3):**
When we build the web UI for reviewing audit results:
- Root URL → Dashboard showing recent audits
- `/review/[auditId]` → Review interface for specific audit
- `/api/webhooks/changelog` → Continues to work as webhook endpoint

### Current Behavior

**Root URL (`GET /`):**
```
HTTP 404 - Not Found
```
This is **expected behavior**. The deployment only has API routes, no index page.

**Webhook Endpoint (`GET /api/webhooks/changelog`):**
```
HTTP 405 - Method Not Allowed
{"error": "Method not allowed"}
```
This is **correct**. The endpoint only accepts POST requests from Featurebase.

**Webhook Endpoint (`POST /api/webhooks/changelog`):**
```
HTTP 200 - OK
{"success": true, "message": "Changelog received, audit triggered", "changelogId": "..."}
```
This is the **working webhook** that Featurebase will call.

### Testing the Webhook

Since GET requests return 405, you must use POST to test:

```bash
curl -X POST https://doc-orchestration-system.vercel.app/api/webhooks/changelog \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-123",
    "title": "Test Changelog",
    "content": "Test content",
    "publishedAt": "2026-01-15T12:00:00Z",
    "url": "https://example.com",
    "tags": ["test"]
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Changelog received, audit triggered",
  "changelogId": "test-123"
}
```

### Consequences

**Positive:**
- ✅ Clean separation between webhook and future UI
- ✅ No unnecessary code in production
- ✅ Easy to add Next.js pages later
- ✅ Clear error messages for incorrect usage

**Negative:**
- ❌ Root URL shows 404 (but this is expected for API-only service)
- ❌ No way to verify deployment is live via browser (must use curl/Postman)

### Implementation Notes

**File Structure:**
```
doc-orchestration-system/
├── api/
│   └── webhooks/
│       └── changelog.js        # POST-only webhook endpoint
├── pages/                      # (Future) Next.js pages for UI
│   ├── index.js               # Dashboard
│   └── review/[auditId].js    # Review interface
├── vercel.json                # Deployment config
└── package.json               # Next.js dependencies ready
```

**Vercel Configuration (`vercel.json`):**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/webhooks/changelog",
      "dest": "/api/webhooks/changelog.js"
    }
  ]
}
```

This configuration:
- Builds all files in `api/` as serverless functions
- Maps the route to the handler
- Does NOT include Next.js build (will be added in Phase 3)

### Alternative Considered: Add a Landing Page Now

We considered adding a simple landing page at the root URL:

**Pros:**
- Visiting root URL wouldn't show 404
- Could display webhook documentation
- Could show system status

**Cons:**
- Unnecessary complexity for Phase 1
- Would be replaced anyway in Phase 3 with real UI
- Doesn't add functional value
- More code to maintain

**Decision:** Rejected. Keep it simple, add full UI in Phase 3.

### When to Build the Web UI (Phase 3)

The web UI will be built after:
- ✅ Phase 1: Vercel webhook deployment (complete)
- ⏳ Phase 2: Bidirectional Featurebase sync (next)
- 🔜 Phase 3: Web UI for reviewing audit results

**Why this order:**
1. Webhook must work first (foundation)
2. Sync ensures data flows both ways
3. UI is the final layer that ties everything together

### Related Documents

- [VERCEL-DEPLOYMENT.md](VERCEL-DEPLOYMENT.md) - How to deploy
- [FEATUREBASE-WEBHOOK-SETUP.md](FEATUREBASE-WEBHOOK-SETUP.md) - How to configure webhook
- [DEPLOYMENT-SUMMARY.md](DEPLOYMENT-SUMMARY.md) - What was deployed

---

## ADR-002: Two-Stage Audit Engine

**Date**: 2026-01-14
**Status**: Implemented
**Decision**: Use keyword filtering (Stage 1) + Claude AI analysis (Stage 2)

### Context

Initial audit (V1) sent all 52K words to Claude, which:
- Missed relevant articles due to context overload
- Was expensive (~$0.15 per audit)
- Had occasional hallucinations

### Decision

Implement two-stage audit:

**Stage 1: Keyword Filter**
- Extract keywords from changelog (features, numbers, models)
- Score all articles for relevance
- Filter to top 20 most relevant articles
- Reduces context from 52K words to ~35K tokens

**Stage 2: Claude AI**
- Analyze filtered articles with Claude Haiku 4.5
- Identify exact contradictions with quotes
- Flag incomplete lists
- Return actionable suggestions

### Results

- ✅ Found 5 articles vs 2 in V1
- ✅ More accurate (fewer hallucinations)
- ✅ 50% cost reduction (~$0.07 per audit)
- ✅ Scalable to hundreds of articles

### Implementation

- `lib/keyword-filter.js` - Stage 1 keyword extraction and scoring
- `lib/audit-engine-v3.js` - Two-stage orchestration
- `scripts/test-audit-v3.js` - Testing script

---

## ADR-003: Environment Variables via Vercel Secrets

**Date**: 2026-01-15
**Status**: Implemented
**Decision**: Store sensitive API keys as Vercel environment variables

### Context

The system needs several API keys:
- Featurebase API key
- Anthropic API key
- GitHub token (optional)

### Decision

Store as Vercel environment variables (not in `vercel.json`):

```bash
vercel env add FEATUREBASE_API_KEY production
vercel env add ANTHROPIC_API_KEY production
vercel env add FEATUREBASE_HELP_CENTER_ID production
```

**Why:**
- ✅ Secure (encrypted at rest)
- ✅ Not committed to git
- ✅ Easy to rotate
- ✅ Separate per environment (production/preview/dev)

**Rejected Alternative:** Using `@secrets` references in `vercel.json`
- Required creating secrets first with specific names
- More complex setup
- Same security benefits

### Implementation

- `.env` - Local development (gitignored)
- `scripts/setup-vercel-env.sh` - Helper script to add all env vars
- Vercel dashboard - Production environment variables

---

## Future Architecture Decisions

### To Be Decided (Phase 2):

**ADR-004: Bidirectional Sync Strategy**
- How to handle conflicts between local and Featurebase?
- Should sync be automatic or manual?
- How to track which version is source of truth?

**ADR-005: Audit Storage**
- Where to store audit logs long-term?
- Should they be in git or external database?
- How long to retain audit history?

### To Be Decided (Phase 3):

**ADR-006: Web UI Framework**
- Use Next.js (already in dependencies)?
- Or separate frontend (React SPA)?
- Authentication strategy?

**ADR-007: Approval Workflow**
- How should users approve/reject suggestions?
- Should changes be applied automatically or manually?
- Versioning strategy for approved changes?
