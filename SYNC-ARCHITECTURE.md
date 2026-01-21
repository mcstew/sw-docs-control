# Bidirectional Sync Architecture

**Status**: ✅ IMPLEMENTED
**Date**: Originally designed 2026-01-15, Implemented 2026-01-20

## Overview

This document defines the architecture for bidirectional synchronization between:
- **Local**: Git repository with markdown files (`sudowrite-documentation/`)
- **Remote**: Featurebase help center via REST API

## Goals

1. **Push Changes**: Update Featurebase when local markdown files change
2. **Pull Changes**: Update local files when Featurebase articles are edited
3. **Conflict Detection**: Identify when both sides have changed
4. **Data Integrity**: Never lose content during sync
5. **Traceability**: Track all sync operations and conflicts

## Current State Analysis

### Local Article Format

**File Structure**:
```
sudowrite-documentation/
├── getting-started-{id}.md/
│   └── article.md
├── about-sudowrite-{id}.md/
│   └── article.md
└── ...
```

**Markdown Format**:
```markdown
---
title: "Article Title"
slug: article-slug
category: category-id
imported_at: 2026-01-14T22:21:26.139Z
last_updated: 2026-01-14T22:21:26.139Z
source: notion
---

# Article Title

Article content in markdown...
```

### Featurebase API Capabilities

**Available Operations** (from `lib/featurebase-client.js`):
- `getArticles(params)` - List all articles
- `getArticle(articleId)` - Get single article
- `createArticle(articleData)` - Create new article
- `updateArticle(articleId, articleData)` - Update article
- `deleteArticle(articleId)` - Delete article
- `getCollections(params)` - List categories

**Article Structure** (from API):
```json
{
  "id": "article-id",
  "title": "Article Title",
  "slug": "article-slug",
  "content": "HTML content",
  "collectionId": "collection-id",
  "isPublic": true,
  "updatedAt": "2026-01-15T12:00:00Z",
  ...
}
```

## Architecture Decisions

### ADR-005: Sync Strategy

**Decision**: Manual bidirectional sync with conflict detection

**Options Considered**:

1. **Featurebase as Source of Truth** ❌
   - Pros: Simple, no conflicts
   - Cons: Loses git history benefits, can't work offline

2. **Git as Source of Truth** ❌
   - Pros: Version control, offline work
   - Cons: Featurebase becomes read-only, loses their editing benefits

3. **Bidirectional with Conflict Detection** ✅ **CHOSEN**
   - Pros: Best of both worlds, flexible workflow
   - Cons: More complex, requires conflict resolution

**Rationale**:
- Editors may use Featurebase UI for quick fixes
- Developers prefer markdown + git for larger changes
- AI audits generate local changes that need pushing
- Need to respect both workflows

### ADR-006: Conflict Resolution Strategy

**Decision**: Last-write-wins with manual conflict flagging

**Rules**:
1. **No Conflict**: If only one side changed → sync wins
2. **Simple Conflict**: If both changed → use timestamp, flag for review
3. **Manual Review**: Conflicts saved to `sudowrite-documentation/.conflicts/`

**Implementation**:
```
Compare timestamps:
  local: frontmatter.last_updated
  remote: article.updatedAt

If both > last_sync_time:
  → Conflict detected
  → Save both versions
  → Create conflict report
  → Use newer timestamp (last-write-wins)
  → Flag for manual review
```

### ADR-007: Sync Tracking

**Decision**: Track sync state in local JSON file

**Sync State File** (`sudowrite-documentation/.sync-state.json`):
```json
{
  "last_sync": "2026-01-15T12:00:00Z",
  "articles": {
    "article-id-123": {
      "local_path": "sudowrite-documentation/title-id.md",
      "remote_id": "article-id-123",
      "last_synced_at": "2026-01-15T12:00:00Z",
      "last_synced_hash": "abc123...",
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
      "resolution": "used_remote",
      "resolved_at": "2026-01-15T12:31:00Z"
    }
  ]
}
```

### ADR-008: ID Mapping

**Decision**: Use Featurebase article ID in filename

**Current Pattern**:
```
sudowrite-documentation/article-title-{featurebase-id}.md/
```

**Why**:
- ✅ Easy to map local ↔ remote
- ✅ No separate mapping database needed
- ✅ Survives file renames
- ❌ Filename includes ID (aesthetic concern only)

**Alternative Considered**: Separate mapping file
- More complex, prone to desync
- Rejected for YAGNI principle

## Sync Workflows

### Workflow 1: Sync TO Featurebase (Push)

**Trigger**: Manual (`npm run sync:to-featurebase`)

**Process**:
```
1. Scan local articles directory
2. For each article:
   a. Extract Featurebase ID from filename/frontmatter
   b. Read local content and frontmatter
   c. Check sync state - has local changed since last sync?
   d. If changed:
      - Fetch remote article
      - Compare timestamps
      - If no remote changes → push local
      - If remote changed → conflict detection
3. Update sync state file
4. Generate sync report
```

**Pseudo-code**:
```javascript
async function syncToFeaturebase() {
  const articles = await scanLocalArticles();
  const syncState = await loadSyncState();
  const results = { pushed: [], conflicts: [], errors: [] };

  for (const article of articles) {
    const localHash = hashContent(article.content);
    const lastSync = syncState.articles[article.id];

    // Skip if unchanged locally
    if (lastSync && lastSync.last_synced_hash === localHash) {
      continue;
    }

    // Fetch remote
    const remote = await featurebase.getArticle(article.id);

    // Check for conflict
    if (lastSync && remote.updatedAt > lastSync.last_synced_at) {
      if (article.last_updated > lastSync.last_synced_at) {
        // Both changed - conflict!
        await handleConflict(article, remote, 'push');
        results.conflicts.push(article.id);
        continue;
      }
    }

    // Push to remote
    await featurebase.updateArticle(article.id, {
      title: article.title,
      content: markdownToHtml(article.content),
      // ... other fields
    });

    // Update sync state
    syncState.articles[article.id] = {
      last_synced_at: new Date().toISOString(),
      last_synced_hash: localHash,
      sync_direction: 'push'
    };

    results.pushed.push(article.id);
  }

  await saveSyncState(syncState);
  return results;
}
```

### Workflow 2: Sync FROM Featurebase (Pull)

**Trigger**: Manual (`npm run sync:from-featurebase`)

**Process**:
```
1. Fetch all articles from Featurebase
2. For each remote article:
   a. Find corresponding local file
   b. If local doesn't exist → create new
   c. If local exists:
      - Check sync state
      - Compare timestamps
      - If no local changes → pull remote
      - If local changed → conflict detection
3. Update sync state file
4. Generate sync report
```

**Pseudo-code**:
```javascript
async function syncFromFeaturebase() {
  const helpCenterId = process.env.FEATUREBASE_HELP_CENTER_ID;
  const remote = await featurebase.getArticles({ help_center_id: helpCenterId });
  const syncState = await loadSyncState();
  const results = { pulled: [], created: [], conflicts: [], errors: [] };

  for (const remoteArticle of remote.data) {
    const localPath = findLocalArticle(remoteArticle.id);

    // New article - create locally
    if (!localPath) {
      await createLocalArticle(remoteArticle);
      results.created.push(remoteArticle.id);
      continue;
    }

    const local = await readLocalArticle(localPath);
    const lastSync = syncState.articles[remoteArticle.id];

    // Check for conflict
    if (lastSync) {
      if (local.last_updated > lastSync.last_synced_at &&
          remoteArticle.updatedAt > lastSync.last_synced_at) {
        // Both changed - conflict!
        await handleConflict(local, remoteArticle, 'pull');
        results.conflicts.push(remoteArticle.id);
        continue;
      }
    }

    // Pull from remote
    await updateLocalArticle(localPath, remoteArticle);

    // Update sync state
    syncState.articles[remoteArticle.id] = {
      last_synced_at: new Date().toISOString(),
      last_synced_hash: hashContent(local.content),
      sync_direction: 'pull'
    };

    results.pulled.push(remoteArticle.id);
  }

  await saveSyncState(syncState);
  return results;
}
```

### Workflow 3: Conflict Resolution

**Process**:
```
1. Detect conflict (both sides changed)
2. Save both versions:
   - `conflicts/{article-id}-local-{timestamp}.md`
   - `conflicts/{article-id}-remote-{timestamp}.md`
3. Apply last-write-wins (newer timestamp)
4. Log conflict in sync state
5. Notify user via CLI output
6. User can manually review/merge later
```

**Conflict Report Format**:
```
CONFLICT DETECTED
=================
Article: "Getting Started" (ID: abc123)
Local updated: 2026-01-15 11:00:00
Remote updated: 2026-01-15 11:30:00

Resolution: Used remote (newer timestamp)

Files saved:
- sudowrite-documentation/.conflicts/abc123-local-2026-01-15T11-00-00.md
- sudowrite-documentation/.conflicts/abc123-remote-2026-01-15T11-30-00.md

Action: Review and merge manually if needed
```

## Data Transformations

### Markdown ↔ HTML

**Push (Local → Featurebase)**:
- Convert markdown to HTML
- Preserve Featurebase-specific formatting
- Handle images, links, embeds

**Pull (Featurebase → Local)**:
- Convert HTML to markdown (using Turndown)
- Clean up Featurebase-specific HTML
- Preserve frontmatter

### Frontmatter Mapping

**Local Frontmatter → Featurebase API**:
```
title         → title
slug          → slug
category      → collectionId
last_updated  → (read-only, from updatedAt)
```

**Featurebase API → Local Frontmatter**:
```
id            → (filename: title-{id}.md)
title         → title
slug          → slug
collectionId  → category
updatedAt     → last_updated
```

## Error Handling

**Network Failures**:
- Retry with exponential backoff
- Save partial progress
- Resume from last successful sync

**API Errors**:
- Log error with article ID
- Continue with next article
- Report all errors at end

**File System Errors**:
- Fail fast (don't push to remote if can't read local)
- Create backups before overwriting

## Security Considerations

**API Keys**:
- Never log API keys
- Use environment variables only

**Data Validation**:
- Validate article IDs before API calls
- Sanitize content before pushing
- Verify HTML to markdown conversion

**Backup**:
- Create backup before bulk operations
- Keep conflict files indefinitely
- Never delete without confirmation

## Success Metrics

**Phase 2 Complete When**:
- [x] Can push local changes to Featurebase
- [x] Can pull Featurebase changes locally
- [x] Conflicts are detected and logged
- [x] No data loss during sync
- [x] Sync completes in under 30 seconds
- [x] Clear documentation exists

## Implementation Plan

### Step 1: Core Sync Library
File: `lib/featurebase-sync.js`
- `scanLocalArticles()` - Find all local markdown files
- `loadSyncState()` / `saveSyncState()` - Manage sync state
- `hashContent()` - Content hashing for change detection
- `handleConflict()` - Conflict detection and resolution

### Step 2: Push Script
File: `scripts/sync-to-featurebase.js`
- Implement push workflow
- Test with single article
- Test with multiple articles
- Test conflict scenarios

### Step 3: Pull Script
File: `scripts/sync-from-featurebase.js`
- Implement pull workflow
- Test with single article
- Test with new articles
- Test conflict scenarios

### Step 4: Documentation
File: `SYNC-GUIDE.md`
- How to run sync commands
- How to resolve conflicts
- Troubleshooting guide

## Testing Strategy

**Unit Tests** (manual for now):
1. Push unchanged article → should skip
2. Push changed article → should update remote
3. Pull unchanged article → should skip
4. Pull changed article → should update local
5. Both changed → should detect conflict

**Integration Tests**:
1. Full push cycle
2. Full pull cycle
3. Push → Pull → verify identical
4. Create conflict → verify both saved

**Edge Cases**:
1. New article locally → push creates remote
2. New article remotely → pull creates local
3. Deleted article (future enhancement)
4. Network failure mid-sync → resume

## Future Enhancements

**Phase 2.1** (Optional):
- [ ] Automatic sync on git commit (git hook)
- [ ] Automatic sync on webhook (after audit)
- [ ] Three-way merge for conflicts (git-style)
- [ ] Dry-run mode (`--dry-run` flag)

**Phase 2.2** (Optional):
- [ ] Selective sync (specific articles only)
- [ ] Category/collection sync
- [ ] Image asset sync
- [ ] Deletion handling

**Phase 3 Integration**:
- [ ] Web UI for conflict resolution
- [ ] Visual diff for conflicts
- [ ] One-click merge options
