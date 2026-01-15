# SW Docs Control

AI-powered documentation control system for Sudowrite. Automatically detects documentation updates needed when product changes are announced, with bidirectional sync between local git repository and Featurebase help center.

## 🌐 Production Deployment

**Vercel Webhook**: https://sw-docs-control.vercel.app/api/webhooks/changelog

**Root URL**: https://sw-docs-control.vercel.app/

Shows system status, webhook documentation, and health checks.

## 🎯 Key Features

- **🤖 AI-Powered Audits**: Two-stage audit system (keyword filtering + Claude Haiku 4.5) identifies documentation that needs updating
- **🔄 Bidirectional Sync**: Keep local markdown and Featurebase help center in sync
- **⚠️ Conflict Detection**: Automatic conflict detection with last-write-wins resolution
- **📝 Version Control**: Full git history for all documentation changes
- **🪝 Webhook Integration**: Automatic audits triggered by Featurebase changelog webhooks
- **🔗 GitHub Issues**: Optional automatic issue creation for needed updates

## 📊 System Overview

```
Changelog Published (Featurebase)
        ↓
Webhook → Vercel Endpoint
        ↓
Two-Stage AI Audit
  Stage 1: Keyword filtering (top 20 articles)
  Stage 2: Claude AI deep analysis
        ↓
Audit Results Saved
        ↓
[Manual Review & Edit Locally]
        ↓
Sync TO Featurebase
        ↓
Updated Live Documentation
```

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/mcstew/sw-docs-control.git
cd sw-docs-control
npm install
```

### 2. Configure Environment

Create `.env` file (see `.env.example`):

```bash
FEATUREBASE_API_KEY=your-api-key
FEATUREBASE_HELP_CENTER_ID=your-help-center-id
ANTHROPIC_API_KEY=your-anthropic-key
```

### 3. Pull Documentation

```bash
# Pull all articles from Featurebase
npm run sync:from-featurebase
```

### 4. Run Audit

```bash
# Test audit on sample changelog
npm run audit
```

## 📚 Commands

### Core Operations
- `npm run audit` - Run AI audit on sample changelog
- `npm run export` - Generate full-scroll markdown export
- `npm run sync:to-featurebase` - Push local changes to Featurebase
- `npm run sync:from-featurebase` - Pull updates from Featurebase

### Testing
- `npm run test:audit` - Test audit engine
- `npm run test:webhook` - Test webhook endpoint locally

### Development
- `npm run dev` - Start Next.js dev server (for future web UI)

## 🔄 Sync Workflow

### Edit in Featurebase → Sync to Local

1. Someone edits an article in Featurebase UI
2. Run sync to pull changes:
   ```bash
   npm run sync:from-featurebase
   ```
3. Changes appear in `docs-source/articles/`
4. Review changes with git diff
5. Commit to GitHub:
   ```bash
   git add docs-source/
   git commit -m "Sync from Featurebase: Article updates"
   git push
   ```

### Edit Locally → Sync to Featurebase

1. Edit article in `docs-source/articles/`
2. Run audit to check for issues (optional):
   ```bash
   npm run audit
   ```
3. Push changes to Featurebase:
   ```bash
   npm run sync:to-featurebase
   ```
4. Commit to GitHub:
   ```bash
   git add docs-source/
   git commit -m "Update documentation: [description]"
   git push
   ```

## 📁 Project Structure

```
sw-docs-control/
├── api/
│   └── webhooks/
│       └── changelog.js          # Webhook endpoint (Vercel)
├── docs-source/
│   ├── articles/                 # Documentation markdown files
│   ├── exports/                  # Generated full-scroll exports
│   ├── audits/                   # AI audit logs
│   ├── conflicts/                # Conflict resolution files
│   └── sync-state.json           # Sync tracking state
├── lib/
│   ├── audit-engine-v3.js        # Two-stage audit engine
│   ├── keyword-filter.js         # Keyword extraction
│   ├── featurebase-client.js     # API client
│   ├── featurebase-sync.js       # Sync logic
│   └── github-client.js          # GitHub integration
└── scripts/
    ├── sync-to-featurebase.js    # Push script
    ├── sync-from-featurebase.js  # Pull script
    └── test-audit-v3.js          # Audit test script
```

## 📖 Documentation

- [SYNC-GUIDE.md](SYNC-GUIDE.md) - Complete sync usage guide
- [SYNC-ARCHITECTURE.md](SYNC-ARCHITECTURE.md) - Sync system design
- [VERCEL-DEPLOYMENT.md](VERCEL-DEPLOYMENT.md) - Deployment guide
- [FEATUREBASE-WEBHOOK-SETUP.md](FEATUREBASE-WEBHOOK-SETUP.md) - Webhook configuration
- [ARCHITECTURE-DECISIONS.md](ARCHITECTURE-DECISIONS.md) - All ADRs
- [PROGRESS.md](PROGRESS.md) - Project status

## 🔐 Security

- **Never commit `.env` files** - They contain sensitive API keys
- **API keys are encrypted** in Vercel environment variables
- **Private repository** - Keep this repo private to protect credentials
- **Conflict files** contain full article content - review before sharing

## 🎯 Current Status

### Phase 1: Webhook Deployment ✅
- Webhook live on Vercel
- Automatic audits on changelog publish
- Root URL info page deployed

### Phase 2: Bidirectional Sync ✅
- Pull from Featurebase working
- Push to Featurebase working
- Conflict detection implemented
- **Ready for production testing**

### Phase 3: Web UI ⏸️
- Dashboard for audit review (future)
- Visual conflict resolution (future)
- Direct editing interface (future)

## 🧪 Testing Sync

To test the sync workflow:

1. **Edit in Featurebase**:
   - Go to Featurebase admin
   - Edit any article
   - Save changes

2. **Pull changes**:
   ```bash
   npm run sync:from-featurebase
   ```

3. **Verify on GitHub**:
   ```bash
   git diff docs-source/
   git add docs-source/
   git commit -m "Sync from Featurebase"
   git push
   ```

4. **Check GitHub**: https://github.com/mcstew/sw-docs-control/commits/main

## 🔗 Links

- **GitHub Repo**: https://github.com/mcstew/sw-docs-control
- **Vercel Deployment**: https://sw-docs-control.vercel.app
- **Webhook Endpoint**: https://sw-docs-control.vercel.app/api/webhooks/changelog

## 📝 License

MIT

## 🤝 Contributing

This is a private repository for Sudowrite documentation management.

---

**Built with**: Claude Code, Next.js, Vercel, Featurebase API, Anthropic Claude
