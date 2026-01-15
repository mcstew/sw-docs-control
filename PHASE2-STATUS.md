# Phase 2 Status: AI Audit Engine

## ✅ Completed

### 1. Webhook Receiver (`api/webhooks/changelog.js`)
- Accepts POST requests from Featurebase changelog webhooks
- Validates payload and extracts changelog data
- Triggers audit asynchronously
- Ready to deploy on Vercel

### 2. AI Audit Engine (`lib/audit-engine.js`)
- Uses Claude Haiku 4.5 (200K context window)
- Analyzes full documentation corpus (52k words)
- Identifies affected articles with:
  - Specific passages that need updating
  - Confidence scores (high/medium/low)
  - Suggested changes
  - Change types (update/addition/removal)
- Saves audit logs to `docs-source/audits/`
- Over-flags intentionally (catches everything)

### 3. GitHub Integration (`lib/github-client.js`)
- Creates GitHub issues automatically for affected articles
- Formats audit results as readable markdown
- Adds labels based on confidence and impact
- Includes methods for updating and closing issues

### 4. Test Script (`scripts/test-audit.js`)
- Tests audit engine with sample changelog
- Validates the full audit workflow
- No API calls required for testing structure

## 🔑 Required Setup

To test the audit engine, you need to add your Anthropic API key:

```bash
# Edit .env file
ANTHROPIC_API_KEY=sk-ant-...  # Your Anthropic API key
```

Optional (for GitHub issue creation):
```bash
GITHUB_TOKEN=ghp_...  # Your GitHub personal access token
GITHUB_REPO=owner/repo  # e.g., "sudowrite/docs"
```

## 🧪 Testing

Run the audit test:
```bash
npm run test:audit
```

This will:
1. Load your full documentation (52k words)
2. Analyze a sample changelog entry about Story Bible updates
3. Identify which articles need updates
4. Show specific passages and suggested changes
5. Save audit log to `docs-source/audits/`

## 📊 How It Works

### Workflow:
```
Changelog Published
       ↓
Webhook Triggered (/api/webhooks/changelog)
       ↓
Load Full Documentation (full-scroll.md)
       ↓
Claude Haiku 4.5 Analysis
  • Reads entire doc corpus
  • Identifies affected articles
  • Quotes specific passages
  • Suggests changes
       ↓
Save Audit Log (JSON)
       ↓
Create GitHub Issue
  • Title: [Doc Audit] Changelog Title
  • Body: Formatted audit results
  • Labels: documentation, ai-audit, high-priority
```

### AI Prompt Strategy:
- Over-flag approach (catches everything)
- Requires specific passage quotes (not just article names)
- Confidence scoring helps prioritize review
- Structured JSON output for automation

## 🚀 Next Steps

1. **Test the audit engine** - Add API key and run `npm run test:audit`
2. **Review audit results** - Check the generated audit log
3. **Deploy webhook to Vercel** - Make it live for changelog triggers
4. **Set up GitHub repo** - Add token and repo to .env
5. **Create first real audit** - Trigger from actual changelog

## 📁 New Files Created

```
doc-orchestration-system/
├── api/
│   └── webhooks/
│       └── changelog.js          # Webhook endpoint
├── lib/
│   ├── audit-engine.js           # Core AI audit logic
│   └── github-client.js          # GitHub API integration
├── scripts/
│   └── test-audit.js             # Test script
└── docs-source/
    └── audits/                   # Audit logs (generated)
        └── audit-TIMESTAMP.json
```

## 💰 Cost Estimate

**Claude Haiku 4.5 Pricing:**
- $1 per million input tokens
- $5 per million output tokens

**Per audit:**
- Input: ~60K tokens (full docs + changelog)
- Output: ~2K tokens (audit results)
- Cost: ~$0.07 per audit

**Weekly changelogs:**
- 1 changelog/week × $0.07 = **~$0.07/week** or **$3.50/year**

Very cost-effective for proactive documentation maintenance!
