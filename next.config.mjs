/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow importing .js ES modules from lib/
    esmExternals: true,
    // Packages that need Node.js runtime (not bundled)
    serverComponentsExternalPackages: ['gray-matter', 'turndown', 'cheerio'],
    // Keep the checked-in roll-up available to public route handlers.
    outputFileTracingIncludes: {
      '/public': ['./docs-rollup.md'],
      '/public/raw': ['./docs-rollup.md'],
    },
  },
};

export default nextConfig;
