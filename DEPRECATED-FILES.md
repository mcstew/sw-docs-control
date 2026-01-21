# Deprecated Files

This document tracks deprecated files in the repository that are kept for reference but should not be used.

## Last Updated
2026-01-21

## Deprecated Audit Engines

### lib/audit-engine.js
- **Status**: DEPRECATED (V1 Baseline)
- **Replacement**: lib/audit-engine-v3.js
- **Reason**: Superseded by two-stage approach in V3
- **Keep**: For reference and comparison testing

### lib/audit-engine-improved.js
- **Status**: DEPRECATED (V1.5)
- **Replacement**: lib/audit-engine-v3.js
- **Reason**: Superseded by two-stage approach in V3
- **Action**: Consider removing after V3 is stable

### lib/audit-engine-v2.js
- **Status**: DEPRECATED (V2 Gemini)
- **Replacement**: lib/audit-engine-v3.js
- **Reason**: Gemini quota exhausted, superseded by V3
- **Action**: Can be safely removed

## Deprecated Test Scripts

### scripts/test-audit.js
- **Status**: DEPRECATED
- **Replacement**: scripts/test-audit-v3.js
- **Reason**: Tests V1 audit engine
- **Keep**: For comparison testing only

### scripts/test-audit-improved.js
- **Status**: DEPRECATED
- **Replacement**: scripts/test-audit-v3.js
- **Reason**: Tests V1.5 audit engine
- **Action**: Can be removed

### scripts/test-audit-v2.js
- **Status**: DEPRECATED
- **Replacement**: scripts/test-audit-v3.js
- **Reason**: Tests V2 Gemini audit engine (no longer available)
- **Action**: Can be removed

## One-Time Migration Scripts

These scripts were used during the initial setup and migration to the new structure. They are no longer needed.

### scripts/import-from-notion.js
- **Status**: ONE-TIME USE (Complete)
- **Purpose**: Imported articles from Notion export
- **Action**: Archive or remove

### scripts/import-from-helpkit.js
- **Status**: ONE-TIME USE (Complete)
- **Purpose**: Imported articles from Helpkit
- **Action**: Archive or remove

### scripts/reorganize-docs.js
- **Status**: ONE-TIME USE (Complete)
- **Purpose**: Migrated from flat structure to sudowrite-documentation
- **Action**: Archive or remove

### scripts/reorganize-folders.cjs
- **Status**: ONE-TIME USE (Complete)
- **Purpose**: Reorganized into collection hierarchy
- **Action**: Archive or remove

## Debug/Development Scripts

### scripts/debug-collections.js
- **Status**: DEVELOPMENT ONLY
- **Purpose**: Debug collection mapping
- **Action**: Remove if not actively debugging

### scripts/debug-featurebase-api.js
- **Status**: DEVELOPMENT ONLY
- **Purpose**: Debug API responses
- **Action**: Remove if not actively debugging

### scripts/debug-sync-error.js
- **Status**: DEVELOPMENT ONLY (Likely obsolete)
- **Purpose**: Debug sync issues
- **Action**: Remove (sync now working)

## Other Potentially Obsolete

### scripts/test-featurebase.js
- **Status**: UNCLEAR
- **Purpose**: Basic API test
- **Replacement**: Possibly scripts/reconcile-articles.js
- **Action**: Investigate and possibly remove

### scripts/export-for-agents.js
- **Status**: UNCLEAR
- **Replacement**: scripts/generate-rollups.js creates better output
- **Action**: Investigate - may still be useful for different format

### scripts/reconcile-articles.js
- **Status**: ACTIVE but needs path update
- **Purpose**: Compare local vs Featurebase
- **Action**: Update to use sudowrite-documentation path

## Active Files (Do NOT Deprecate)

These files are actively used:

- ✅ lib/audit-engine-v3.js - Current audit engine
- ✅ lib/featurebase-sync.js - Sync utilities
- ✅ lib/featurebase-client.js - API wrapper
- ✅ lib/collection-hierarchy.js - Collection mapping
- ✅ lib/keyword-filter.js - Stage 1 filtering
- ✅ scripts/sync-to-featurebase.js - Push changes
- ✅ scripts/sync-from-featurebase.js - Pull changes
- ✅ scripts/generate-rollups.js - AI knowledge files
- ✅ scripts/test-audit-v3.js - Test current audit
- ✅ scripts/test-keyword-filter.js - Test filtering

## Recommended Actions

### Immediate
1. Update package.json to clearly mark deprecated test commands
2. Add deprecation warnings to old audit engine files

### Short-term
3. Move one-time migration scripts to `scripts/deprecated/` folder
4. Remove debug scripts that are no longer needed

### Long-term
5. After V3 is proven stable, consider removing V1 and V2 completely
6. Clean up package.json test commands
