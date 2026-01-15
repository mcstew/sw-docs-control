# Featurebase Webhook Configuration

Now that your webhook is deployed to Vercel, you need to configure Featurebase to send changelog webhooks to your endpoint.

## Your Webhook Details

**Production Webhook URL:**
```
https://sw-docs-control.vercel.app/api/webhooks/changelog
```

## Configure Featurebase Webhook

### Step 1: Access Featurebase Settings

1. Log in to your Featurebase account at https://do.featurebase.app/
2. Navigate to your workspace settings
3. Look for **Webhooks** or **Integrations** section

### Step 2: Create New Webhook

Create a new webhook with these settings:

**Basic Settings:**
- **Name**: Documentation Audit Webhook
- **URL**: `https://sw-docs-control.vercel.app/api/webhooks/changelog`
- **Method**: `POST`
- **Content-Type**: `application/json`

**Event Trigger:**
- Event type: `changelog.published` (or equivalent)
- Trigger: When a changelog entry is published

**Expected Payload Format:**
The webhook expects a JSON payload with these fields:
```json
{
  "id": "changelog-id",
  "title": "Changelog Title",
  "content": "Full changelog content/description",
  "publishedAt": "2024-01-15T12:00:00Z",
  "url": "https://your-site.com/changelog/entry",
  "tags": ["tag1", "tag2"]
}
```

### Step 3: Test the Webhook

Featurebase should provide a way to test webhooks. Use this test payload:

```json
{
  "id": "test-webhook-456",
  "title": "Test Changelog Entry",
  "content": "This is a test changelog to verify the webhook integration is working correctly.",
  "publishedAt": "2026-01-15T22:30:00Z",
  "url": "https://sudowrite.com/changelog/test",
  "tags": ["test", "webhook-verification"]
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Changelog received, audit triggered",
  "changelogId": "test-webhook-456"
}
```

### Step 4: Verify Webhook is Working

After setting up the webhook, you can verify it's working by:

1. **Publishing a test changelog** in Featurebase
2. **Check Vercel logs** to see if the webhook was received:
   ```bash
   vercel logs https://sw-docs-control.vercel.app
   ```
3. **Check audit logs** in your repository (if you have them synced)

## Webhook Behavior

### What Happens When a Changelog is Published:

1. **Featurebase sends webhook** → Your Vercel endpoint receives it
2. **Webhook responds immediately** (200 OK) to Featurebase
3. **Audit runs asynchronously** in the background:
   - Loads full documentation corpus
   - Runs two-stage AI audit (keyword filter + Claude analysis)
   - Identifies affected articles
   - Creates GitHub issues (if configured)
   - Saves audit log

### Timeout Considerations

- The webhook function has a **5-minute timeout** (configured in vercel.json)
- The audit typically completes in 10-30 seconds for ~100 articles
- If the audit takes longer, it will still complete but may not log to Vercel

## Testing from Command Line

You can manually trigger the webhook anytime:

```bash
curl -X POST https://sw-docs-control.vercel.app/api/webhooks/changelog \
  -H "Content-Type: application/json" \
  -d '{
    "id": "manual-test-789",
    "title": "Manual Test Changelog",
    "content": "Testing the webhook manually from command line",
    "publishedAt": "2026-01-15T23:00:00Z",
    "url": "https://sudowrite.com/changelog/manual-test",
    "tags": ["manual-test"]
  }'
```

## Troubleshooting

### Webhook Not Firing

**Check:**
1. Is the webhook URL correct in Featurebase?
2. Is the webhook enabled/active in Featurebase?
3. Are you publishing changelogs (not just saving drafts)?
4. Check Vercel deployment logs for errors

### Webhook Receives but Audit Fails

**Check Vercel logs:**
```bash
vercel logs https://sw-docs-control.vercel.app
```

**Common issues:**
- Missing environment variables (ANTHROPIC_API_KEY, FEATUREBASE_API_KEY)
- Insufficient Vercel timeout for large documentation
- API rate limits or quotas exceeded

### Payload Format Issues

If Featurebase sends a different payload format, you may need to:
1. Update the webhook handler in `api/webhooks/changelog.js`
2. Map Featurebase's field names to expected format
3. Redeploy to Vercel

## Security Considerations

### Webhook Security (Optional Enhancement)

Currently, the webhook is public and accepts any POST request. For production, consider adding:

1. **Webhook Secret Verification**
   - Featurebase should provide a webhook secret
   - Add secret verification to `api/webhooks/changelog.js`
   - Reject requests with invalid signatures

2. **IP Allowlist**
   - Restrict webhook endpoint to Featurebase's IP addresses
   - Use Vercel firewall or middleware

3. **Rate Limiting**
   - Prevent abuse by limiting requests per time period
   - Use Vercel Edge Config or middleware

## Monitoring

### View Recent Webhook Activity

**Vercel Dashboard:**
1. Go to https://vercel.com/sudowrite/doc-orchestration-system
2. Click **Functions** tab
3. Select `/api/webhooks/changelog`
4. View invocation logs and errors

**Command Line:**
```bash
vercel logs https://sw-docs-control.vercel.app
```

### Set Up Alerts (Optional)

Configure Vercel alerts to notify you when:
- Webhook function fails
- Response time exceeds threshold
- Error rate spikes

## Next Steps

After webhook is configured:

1. ✅ Publish a real changelog in Featurebase
2. ✅ Verify webhook triggers automatically
3. ✅ Review audit results
4. ✅ Configure GitHub integration (optional)
5. ✅ Set up monitoring and alerts

## Support

If you encounter issues:
1. Check Featurebase webhook documentation
2. Review Vercel function logs
3. Test webhook manually with curl
4. Verify environment variables are set correctly
