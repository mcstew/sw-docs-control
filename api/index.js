/**
 * Root endpoint - Information page
 * Displays system info and webhook documentation
 */

export default function handler(req, res) {
  const baseUrl = `https://${req.headers.host}`;

  res.status(200).json({
    name: "Documentation Orchestration System",
    version: "1.0.0",
    status: "operational",
    description: "AI-powered documentation maintenance system for Sudowrite",

    endpoints: {
      webhook: {
        url: `${baseUrl}/api/webhooks/changelog`,
        method: "POST",
        description: "Receives Featurebase changelog webhooks and triggers documentation audits",
        auth: "None (consider adding webhook secret verification)",
        example: {
          payload: {
            id: "changelog-id",
            title: "Changelog Title",
            content: "Changelog description",
            publishedAt: "2026-01-15T12:00:00Z",
            url: "https://sudowrite.com/changelog/entry",
            tags: ["tag1", "tag2"]
          },
          response: {
            success: true,
            message: "Changelog received, audit triggered",
            changelogId: "changelog-id"
          }
        }
      }
    },

    features: [
      "Two-stage AI audit (keyword filter + Claude Haiku 4.5)",
      "Automatic documentation update detection",
      "GitHub issue creation for affected articles",
      "Cost-effective (~$0.07 per audit)"
    ],

    documentation: {
      deployment: "https://github.com/sudowrite/doc-orchestration-system/blob/main/VERCEL-DEPLOYMENT.md",
      webhookSetup: "https://github.com/sudowrite/doc-orchestration-system/blob/main/FEATUREBASE-WEBHOOK-SETUP.md",
      architecture: "https://github.com/sudowrite/doc-orchestration-system/blob/main/ARCHITECTURE-DECISIONS.md"
    },

    testing: {
      curl: `curl -X POST ${baseUrl}/api/webhooks/changelog -H "Content-Type: application/json" -d '{"id":"test","title":"Test","content":"Test content","publishedAt":"2026-01-15T12:00:00Z","url":"https://example.com","tags":[]}'`
    },

    deployment: {
      platform: "Vercel",
      runtime: "Node.js (Serverless Functions)",
      region: "iad1 (Washington, D.C.)",
      environment: process.env.VERCEL_ENV || "development"
    },

    health: {
      webhook: "operational",
      featurebaseApi: process.env.FEATUREBASE_API_KEY ? "configured" : "not configured",
      anthropicApi: process.env.ANTHROPIC_API_KEY ? "configured" : "not configured",
      githubIntegration: process.env.GITHUB_TOKEN ? "configured" : "optional"
    }
  });
}
