/**
 * Test Webhook Endpoint Locally
 * Tests the changelog webhook handler without deploying
 */

import handler from '../api/webhooks/changelog.js';

// Mock request and response objects
const mockReq = {
  method: 'POST',
  body: {
    id: 'test-changelog-123',
    title: 'Bigger, Better Rewrite',
    content: `We just updated the Rewrite feature so that it can be used on up to 9,000 words. We also changed the model powering it. Rewrite now uses Muse, so you get the highest quality rewrites possible. Happy writing!`,
    publishedAt: new Date().toISOString(),
    url: 'https://sudowrite.com/changelog/rewrite-update',
    tags: ['feature-update', 'rewrite', 'muse']
  }
};

const mockRes = {
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    console.log('\n=== Response ===');
    console.log(`Status: ${this.statusCode}`);
    console.log('Body:', JSON.stringify(data, null, 2));
    return this;
  }
};

console.log('=== Testing Webhook Handler ===\n');
console.log('Request:', {
  method: mockReq.method,
  body: mockReq.body
});

try {
  await handler(mockReq, mockRes);
  console.log('\n✅ Webhook handler test completed');
  console.log('📝 Note: The audit runs asynchronously. Check docs-source/audits/ for results.');
} catch (error) {
  console.error('\n❌ Webhook handler test failed:', error);
  process.exit(1);
}
