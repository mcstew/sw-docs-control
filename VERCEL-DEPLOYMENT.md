# Vercel Deployment Guide

This guide walks you through deploying the Documentation Orchestration System webhook to Vercel.

## Prerequisites

1. **Vercel CLI** - Install if you haven't already:
   ```bash
   npm install -g vercel
   ```

2. **Environment Variables** - You'll need:
   - `FEATUREBASE_API_KEY` - Your Featurebase API key
   - `FEATUREBASE_HELP_CENTER_ID` - Your help center ID
   - `ANTHROPIC_API_KEY` - Your Anthropic API key for Claude
   - `GITHUB_TOKEN` (optional) - GitHub personal access token
   - `GITHUB_REPO` (optional) - Repository in format `owner/repo`

## Deployment Steps

### 1. Login to Vercel

```bash
vercel login
```

### 2. Initial Deployment

Run from the project root:

```bash
vercel
```

This will:
- Create a new Vercel project
- Deploy your webhook endpoint
- Generate a deployment URL

Follow the prompts:
- Set up and deploy? **Yes**
- Which scope? Select your account
- Link to existing project? **No** (first time)
- Project name? Accept default or customize
- Directory? Accept default (`.`)
- Override settings? **No**

### 3. Add Environment Variables

After initial deployment, add your secrets:

```bash
# Featurebase credentials
vercel env add FEATUREBASE_API_KEY
vercel env add FEATUREBASE_HELP_CENTER_ID

# Anthropic API key
vercel env add ANTHROPIC_API_KEY

# Optional: GitHub integration
vercel env add GITHUB_TOKEN
vercel env add GITHUB_REPO
```

For each command:
- Select environment: **Production, Preview, and Development**
- Paste the value when prompted

### 4. Redeploy with Environment Variables

```bash
vercel --prod
```

### 5. Get Your Webhook URL

After deployment, your webhook will be available at:
```
https://your-project.vercel.app/api/webhooks/changelog
```

Vercel will display the URL after deployment.

## Configure Featurebase Webhook

1. Go to your Featurebase admin panel
2. Navigate to **Settings** → **Webhooks**
3. Create a new webhook:
   - **URL**: `https://your-project.vercel.app/api/webhooks/changelog`
   - **Event**: `changelog.published` (or equivalent)
   - **Method**: POST
   - **Content-Type**: application/json

4. Test the webhook with a sample payload

## Testing the Deployment

### Test Endpoint Locally First

```bash
vercel dev
```

Then send a test POST request:

```bash
curl -X POST http://localhost:3000/api/webhooks/changelog \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-123",
    "title": "Test Changelog",
    "content": "This is a test changelog entry",
    "publishedAt": "2024-01-14T12:00:00Z",
    "url": "https://example.com/changelog/test",
    "tags": ["test"]
  }'
```

### Test Production Deployment

```bash
curl -X POST https://your-project.vercel.app/api/webhooks/changelog \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-123",
    "title": "Test Changelog",
    "content": "This is a test changelog entry",
    "publishedAt": "2024-01-14T12:00:00Z",
    "url": "https://example.com/changelog/test",
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

## Monitoring

### View Logs

```bash
vercel logs
```

Or visit the Vercel dashboard:
- Go to your project
- Click **Deployments**
- Select your deployment
- View **Functions** logs

### Common Issues

**Issue**: `Module not found` errors
- **Solution**: Ensure all dependencies are in `package.json`
- Run `npm install` and redeploy

**Issue**: `Environment variable not found`
- **Solution**: Add missing env vars with `vercel env add`
- Redeploy after adding

**Issue**: Timeout errors
- **Solution**: Audit may take longer than expected
- The webhook returns immediately, audit runs async
- Check logs for actual audit results

## Updating the Deployment

After making code changes:

```bash
# Deploy to production
vercel --prod

# Or just deploy to preview
vercel
```

## Project Structure

```
doc-orchestration-system/
├── api/
│   └── webhooks/
│       └── changelog.js       # Webhook endpoint (deployed)
├── lib/
│   ├── audit-engine-v3.js     # Audit logic (used by webhook)
│   ├── keyword-filter.js      # Keyword filtering
│   └── featurebase-client.js  # API client
└── vercel.json                # Vercel configuration
```

## Vercel Configuration

The `vercel.json` file configures:
- **Builds**: Uses `@vercel/node` for API endpoints
- **Routes**: Maps `/api/webhooks/changelog` to the handler
- **Environment**: References to secret environment variables

## Next Steps

After successful deployment:

1. ✅ Test webhook with sample payload
2. ✅ Configure Featurebase to send webhooks
3. ✅ Monitor first real changelog audit
4. ✅ Review audit results in GitHub issues (if configured)
5. ✅ Check audit logs in `sudowrite-documentation/.audits/`

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Vercel CLI**: https://vercel.com/docs/cli
- **Featurebase Webhooks**: Check your Featurebase documentation
