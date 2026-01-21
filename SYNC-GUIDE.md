# Featurebase Sync Guide

Complete guide to bidirectional synchronization between local markdown files and Featurebase help center.

## Overview

The sync system keeps your local documentation repository in sync with your Featurebase help center:

- **Push (Sync TO Featurebase)**: `npm run sync:to-featurebase`
- **Pull (Sync FROM Featurebase)**: `npm run sync:from-featurebase`

Both commands handle conflicts automatically using last-write-wins strategy while saving both versions for manual review.

## Prerequisites

### 1. Environment Variables

Ensure your `.env` file contains:

```bash
FEATUREBASE_API_KEY=sk_ad_...
FEATUREBASE_HELP_CENTER_ID=your-help-center-id
```

### 2. Article Format

Local articles are organized in nested collection/subcollection folders:

```
sudowrite-documentation/
├── getting-started/
│   ├── introduction/
│   │   └── the-basics.md
│   └── sudowrite-manual/
│       └── quick-start.md
├── using-sudowrite/
│   ├── features/
│   │   └── write.md
│   └── sudowrite-mobile-app/
│       └── mobile-app-overview.md
└── ... (other collections)
```

**Article frontmatter:**
```markdown
---
title: "Article Title"
slug: article-slug
category: collection-id
collection_name: Collection Name
featurebase_id: article-uuid
last_updated: 2026-01-15T12:00:00Z
synced_at: 2026-01-15T12:00:00Z
source: local|remote
---

# Article Content

Your markdown content here...
```

## Commands

### Sync TO Featurebase (Push)

Push local changes to Featurebase:

```bash
npm run sync:to-featurebase
```

**What it does:**
1. Scans all local articles
2. Compares with last sync state
3. Skips unchanged articles
4. Pushes changed articles to Featurebase
5. Creates new articles if they don't exist remotely
6. Detects and resolves conflicts

**Example output:**
```
🚀 Syncing TO Featurebase...

Testing Featurebase connection...
✅ Connected to Featurebase

Loading local articles...
Found 99 local articles

Processing: Getting Started (abc-123)
  📤 Pushing to Featurebase...
  ✅ Pushed

Processing: About Sudowrite (def-456)
  ⏭️  Skipped (unchanged since last sync)

============================================================
SYNC TO FEATUREBASE COMPLETE
============================================================
✅ Pushed:    15 articles
📝 Created:   2 articles
⏭️  Skipped:   82 articles (unchanged)
⚠️  Conflicts: 0 articles
❌ Errors:    0 articles
============================================================
```

### Sync FROM Featurebase (Pull)

Pull changes from Featurebase:

```bash
npm run sync:from-featurebase
```

**What it does:**
1. Fetches all articles from Featurebase
2. Compares with local versions
3. Skips unchanged articles
4. Pulls changed articles from Featurebase
5. Creates new local files for new articles
6. Detects and resolves conflicts

**Example output:**
```
🚀 Syncing FROM Featurebase...

Testing Featurebase connection...
✅ Connected to Featurebase

Fetching articles from Featurebase...
Found 99 remote articles

Processing: Getting Started (abc-123)
  ⬇️  Pulling changes from Featurebase...
  ✅ Pulled

Processing: New Article (ghi-789)
  📝 Creating new local file...
  ✅ Created: New Article

============================================================
SYNC FROM FEATUREBASE COMPLETE
============================================================
⬇️  Pulled:    12 articles
📝 Created:   3 articles
⏭️  Skipped:   84 articles (unchanged)
⚠️  Conflicts: 0 articles
❌ Errors:    0 articles
============================================================
```

## Conflict Resolution

### When Conflicts Occur

A conflict happens when:
- Local article was modified since last sync
- Remote article was modified since last sync
- You try to sync in either direction

### How Conflicts Are Handled

**Automatic Resolution:**
1. Compare timestamps (local `last_updated` vs remote `updatedAt`)
2. Use newer version (last-write-wins)
3. Save both versions to `sudowrite-documentation/.conflicts/`
4. Log conflict in sync state

**Conflict Files:**
```
sudowrite-documentation/.conflicts/
├── article-id-local-2026-01-15T12-00-00.md
└── article-id-remote-2026-01-15T12-30-00.md
```

**Example conflict output:**
```
⚠️  CONFLICT DETECTED
============================================================
Article: "Getting Started" (ID: abc-123)
Local updated:  2026-01-15 11:00:00
Remote updated: 2026-01-15 11:30:00
Resolution: Using remote (newer timestamp)

Conflict files saved:
  Local:  sudowrite-documentation/.conflicts/abc-123-local-2026-01-15T11-00-00.md
  Remote: sudowrite-documentation/.conflicts/abc-123-remote-2026-01-15T11-30-00.md

💡 Review and merge manually if needed
============================================================
```

### Manual Conflict Resolution

1. **Review conflict files:**
   ```bash
   cd sudowrite-documentation/.conflicts
   ls -la
   ```

2. **Compare versions:**
   ```bash
   diff abc-123-local-*.md abc-123-remote-*.md
   ```

3. **Merge manually:**
   - Edit the main article file
   - Incorporate changes from both versions
   - Update `last_updated` timestamp

4. **Sync again:**
   ```bash
   npm run sync:to-featurebase  # Push merged version
   ```

5. **Clean up:**
   ```bash
   rm sudowrite-documentation/.conflicts/abc-123-*
   ```

## Sync State

### Sync State File

Location: `sudowrite-documentation/.sync-state.json`

**Format:**
```json
{
  "last_sync": "2026-01-15T12:00:00Z",
  "articles": {
    "article-id-123": {
      "local_path": "sudowrite-documentation/title-id/article.md",
      "remote_id": "article-id-123",
      "last_synced_at": "2026-01-15T12:00:00Z",
      "last_synced_hash": "abc123def456...",
      "sync_direction": "push",
      "status": "synced"
    }
  },
  "conflicts": [
    {
      "article_id": "article-id-456",
      "detected_at": "2026-01-15T12:30:00Z",
      "local_updated": "2026-01-15T11:00:00Z",
      "remote_updated": "2026-01-15T11:30:00Z",
      "resolution": "used_remote"
    }
  ]
}
```

### What Gets Tracked

- **Last sync time**: When last sync operation completed
- **Article sync state**: For each article:
  - Local file path
  - Remote Featurebase ID
  - Last synced timestamp
  - Content hash (for change detection)
  - Sync direction (push/pull)
  - Status (synced/conflict_resolved)
- **Conflict history**: All detected conflicts and resolutions

### Viewing Sync State

```bash
cat sudowrite-documentation/.sync-state.json | jq .
```

## Workflows

### Workflow 1: Initial Setup

First time syncing:

```bash
# Pull all articles from Featurebase
npm run sync:from-featurebase

# Review downloaded articles
ls sudowrite-documentation/

# Make local changes
# ... edit some files ...

# Push changes back
npm run sync:to-featurebase
```

### Workflow 2: Regular Sync

Daily/weekly sync routine:

```bash
# Pull latest from Featurebase
npm run sync:from-featurebase

# Make your changes locally
# ... work on docs ...

# Push changes back
npm run sync:to-featurebase
```

### Workflow 3: After AI Audit

After documentation audit identifies changes:

```bash
# Audit creates suggested changes locally
npm run audit

# Review and edit suggested changes
# ... review audit results ...

# Push approved changes to Featurebase
npm run sync:to-featurebase
```

### Workflow 4: Quick Fix in Featurebase

Someone made a quick edit in Featurebase UI:

```bash
# Pull the change
npm run sync:from-featurebase

# Verify locally
git diff

# Commit to git
git add sudowrite-documentation/
git commit -m "Sync from Featurebase: Quick typo fix"
```

## Best Practices

### 1. Sync Regularly

```bash
# Pull before starting work
npm run sync:from-featurebase

# ... work on docs ...

# Push when done
npm run sync:to-featurebase
```

### 2. Use Git

Commit sync state and articles to git:

```bash
git add sudowrite-documentation/
git commit -m "Sync with Featurebase"
```

### 3. Review Conflicts

Always review conflict files:
- Don't blindly accept last-write-wins
- Manually merge important conflicts
- Keep conflict files until resolved

### 4. Test Before Bulk Sync

Test with one article first:

```bash
# Manual test with single article
node scripts/sync-to-featurebase.js 2>&1 | head -50
```

### 5. Backup Before First Sync

```bash
# Backup local articles
tar -czf articles-backup-$(date +%Y%m%d).tar.gz sudowrite-documentation/

# Or commit to git
git add -A && git commit -m "Backup before first sync"
```

## Troubleshooting

### Error: FEATUREBASE_API_KEY not found

```bash
# Check .env file exists
cat .env | grep FEATUREBASE

# If missing, add it
echo "FEATUREBASE_API_KEY=your-key" >> .env
```

### Error: Failed to connect to Featurebase

```bash
# Test API connection
npm run test:featurebase

# Check API key is valid
# Check network connection
```

### Error: Article not found (404)

**Cause**: Article exists locally but not in Featurebase

**Solution**: Sync will create it automatically:
```bash
npm run sync:to-featurebase
```

### Conflict Every Time

**Cause**: Timestamps not updating correctly

**Solution**:
1. Check frontmatter has `last_updated` field
2. Ensure it updates when you edit
3. Clear sync state and resync:
   ```bash
   rm sudowrite-documentation/.sync-state.json
   npm run sync:from-featurebase  # Fresh sync
   ```

### Articles Not Syncing

**Check:**
1. File has correct format (frontmatter with `featurebase_id`)
2. File is in `sudowrite-documentation/` directory
3. File ends in `.md` or is in a directory with `article.md`

**Debug:**
```bash
# Check what articles are detected
node -e "import('./lib/featurebase-sync.js').then(m => m.scanLocalArticles().then(console.log))"
```

### Sync State Corruption

**Symptoms**: Weird sync behavior, articles syncing repeatedly

**Solution**:
```bash
# Backup current sync state
cp sudowrite-documentation/.sync-state.json sudowrite-documentation/sync-state-backup.json

# Delete and resync
rm sudowrite-documentation/.sync-state.json
npm run sync:from-featurebase  # Rebuild state
```

## Advanced Usage

### Dry Run (Coming Soon)

```bash
# Preview what would be synced
npm run sync:to-featurebase -- --dry-run
```

### Selective Sync (Coming Soon)

```bash
# Sync specific article
npm run sync:to-featurebase -- --article abc-123

# Sync specific category
npm run sync:to-featurebase -- --category getting-started
```

### Sync Statistics

Check sync stats:

```bash
node -e "import('./lib/featurebase-sync.js').then(m => m.getSyncStats().then(s => console.log(JSON.stringify(s, null, 2))))"
```

Output:
```json
{
  "total_articles": 99,
  "synced_articles": 99,
  "last_sync": "2026-01-15T12:00:00Z",
  "conflicts": 2,
  "unsynced_articles": 0
}
```

## Integration with Webhook

The sync system integrates with the webhook audit system:

```
Changelog Published
       ↓
Webhook Triggered
       ↓
AI Audit Runs (identifies changes needed)
       ↓
Local Articles Updated
       ↓
[MANUAL] Review Changes
       ↓
npm run sync:to-featurebase  ← Push to Featurebase
```

**Future Enhancement**: Automatic sync after audit

## Security

### API Keys

- Never commit `.env` to git
- Rotate API keys periodically
- Use separate keys for dev/prod

### Content Validation

- Review conflict resolutions manually
- Don't blindly accept automated merges
- Test changes before pushing to production

### Backup Strategy

```bash
# Daily backup
tar -czf docs-backup-$(date +%Y%m%d).tar.gz sudowrite-documentation/

# Or use git
git add -A && git commit -m "Daily backup"
```

## Support

### Getting Help

1. Check this guide
2. Review `SYNC-ARCHITECTURE.md` for design details
3. Check sync state file for debugging
4. Review conflict files in `sudowrite-documentation/.conflicts/`

### Common Questions

**Q: Can I delete sync-state.json?**
A: Yes, but you'll lose sync history. Next sync will treat everything as new.

**Q: What happens if I delete an article locally?**
A: Current version doesn't sync deletions. Article remains on Featurebase.

**Q: Can multiple people sync simultaneously?**
A: Not recommended. Conflicts will occur. Use git workflow instead.

**Q: How do I know what changed?**
A: Check git diff after sync:
```bash
npm run sync:from-featurebase
git diff sudowrite-documentation/
```

## Next Steps

After setting up sync:
1. ✅ Test sync with one article
2. ✅ Pull all articles from Featurebase
3. ✅ Make local changes and push
4. ✅ Set up regular sync schedule
5. ✅ Integrate with audit workflow
