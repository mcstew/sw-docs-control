/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow importing .js ES modules from lib/
    esmExternals: true,
    // Packages that need Node.js runtime (not bundled)
    serverComponentsExternalPackages: [
      'gray-matter',
      'turndown',
      'cheerio',
      // Agent SDK has native binaries and a Claude Code subprocess wrapper —
      // must stay external to avoid Next bundling its optional native deps.
      '@anthropic-ai/claude-agent-sdk',
    ],
  },
};

export default nextConfig;
