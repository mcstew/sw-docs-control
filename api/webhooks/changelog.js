/**
 * Featurebase Changelog Webhook Handler
 * Receives changelog entry webhooks and triggers documentation audit
 */

import { runAudit } from '../../lib/audit-engine.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 300, // 5 minutes for audit processing
};

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;

    console.log('Received changelog webhook:', {
      id: payload.id,
      title: payload.title,
      timestamp: new Date().toISOString()
    });

    // Validate payload
    if (!payload.title || !payload.content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Extract changelog data
    const changelogData = {
      id: payload.id,
      title: payload.title,
      content: payload.content,
      publishedAt: payload.publishedAt,
      url: payload.url,
      tags: payload.tags || []
    };

    // Trigger audit asynchronously
    // In production, this would be a background job or queue
    runAudit(changelogData).catch(error => {
      console.error('Audit failed:', error);
    });

    // Respond immediately to webhook
    return res.status(200).json({
      success: true,
      message: 'Changelog received, audit triggered',
      changelogId: payload.id
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
