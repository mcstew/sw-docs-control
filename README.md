# Documentation Orchestration System

AI-powered documentation maintenance system that serves as a source of truth for Sudowrite docs.

## Architecture

```
Helpkit/Notion (current docs) → Import → Git (source of truth)
                                            ↓
                                      AI Audit Engine
                                      (Claude Haiku 4.5)
                                            ↓
                                      Review Interface
                                            ↓
                                      Sync → Featurebase
                                      Export → Markdown/PDF
```

## Features

- **Automated Audit**: Changelog entries trigger AI-powered doc audits
- **Smart Suggestions**: Claude identifies affected articles and suggests specific edits
- **Bidirectional Sync**: Git ↔ Featurebase synchronization
- **Agent-Ready Export**: Generate consolidated markdown for AI training
- **Version Control**: Full Git history of all documentation changes

## Project Structure

```
/docs-source
  /articles          # Markdown documentation organized by category
  /exports           # Generated files (full-scroll.md, etc.)
  /scripts           # Import, export, and sync scripts
/api
  /webhooks          # Vercel serverless functions
/lib                 # Shared utilities
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. Import current documentation:
   ```bash
   npm run import
   ```

4. Generate agent training export:
   ```bash
   npm run export
   ```

## Scripts

- `npm run import` - Import docs from Helpkit/Notion
- `npm run export` - Generate full-scroll markdown for AI training
- `npm run sync:to-featurebase` - Push changes to Featurebase
- `npm run sync:from-featurebase` - Pull changes from Featurebase
- `npm run dev` - Start development server

## Workflow

1. **Changelog Published** → Webhook triggers audit
2. **AI Reviews Docs** → Creates GitHub issue with suggestions
3. **Human Reviews** → Approves/edits suggestions
4. **Changes Merged** → Auto-syncs to Featurebase
5. **Export Updated** → New agent training file generated

## Tech Stack

- **Storage**: Git + Markdown
- **AI**: Claude Haiku 4.5 (200K context)
- **Hosting**: Vercel (serverless functions + Next.js)
- **Integrations**: Featurebase API, GitHub API
