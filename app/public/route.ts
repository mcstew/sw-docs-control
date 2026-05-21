import { NextResponse } from 'next/server';
import { parseDocsRollup, readDocsRollup, type DocsRollupSection, type DocsRollupSummary } from '@/lib/docs-rollup-public';

export const dynamic = 'force-static';

export async function GET() {
  const markdown = await readDocsRollup();
  const summary = parseDocsRollup(markdown);

  return new NextResponse(renderPublicDocsPage(summary), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function renderPublicDocsPage(summary: DocsRollupSummary) {
  const generatedLabel = formatTimestamp(summary.generatedAt);
  const sections = summary.sections.map(renderSection).join('\n');
  const navItems = summary.sections
    .filter((section) => section.title !== 'End of Documentation')
    .map((section) => `<a href="#${section.id}">${escapeHtml(section.title)}</a>`)
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Public, full-text Sudowrite documentation roll-up for agent ingestion.">
  <meta name="robots" content="index, follow">
  <title>Sudowrite Public Docs Roll-up</title>
  <style>
    :root {
      color-scheme: light;
      --paper: #fffffb;
      --wash: #f8f7f2;
      --band: #f0eee6;
      --ink: #161616;
      --muted: #54514a;
      --rule: #d9d3c7;
      --accent: #214c42;
      --accent-soft: #edf7f2;
      --mono: "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      --sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      background: var(--wash);
      color: var(--ink);
      font-family: var(--sans);
      font-size: 16px;
      line-height: 1.5;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    .top {
      border-bottom: 1px solid var(--rule);
      background: var(--paper);
    }

    .top-inner,
    .metrics,
    .shell {
      width: min(100%, 1280px);
      margin: 0 auto;
      padding-left: 32px;
      padding-right: 32px;
    }

    .top-inner {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 32px;
      padding-top: 28px;
      padding-bottom: 24px;
    }

    .home {
      display: inline-block;
      margin-bottom: 14px;
      color: #536b63;
      font-size: 0.9rem;
      font-weight: 600;
    }

    h1,
    h2 {
      margin: 0;
      letter-spacing: 0;
      line-height: 1.15;
    }

    h1 {
      max-width: 780px;
      font-size: 2.25rem;
      font-weight: 700;
    }

    .lede {
      max-width: 720px;
      margin: 12px 0 0;
      color: var(--muted);
      font-size: 1rem;
      line-height: 1.7;
    }

    code {
      font-family: var(--mono);
      font-size: 0.95em;
    }

    .formats {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: flex-end;
    }

    .formats a {
      min-height: 40px;
      display: inline-flex;
      align-items: center;
      border: 1px solid #b9c8c2;
      background: #f6fbf8;
      color: var(--accent);
      padding: 8px 12px;
      font-size: 0.92rem;
      font-weight: 700;
    }

    .formats a:hover {
      border-color: #739487;
      background: var(--accent-soft);
    }

    .metric-band {
      border-bottom: 1px solid var(--rule);
      background: var(--band);
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 22px;
      padding-top: 18px;
      padding-bottom: 18px;
    }

    dt {
      color: #716b62;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    dd {
      margin: 4px 0 0;
      color: #24211d;
      font-size: 1rem;
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .shell {
      display: grid;
      grid-template-columns: minmax(0, 240px) minmax(0, 1fr);
      gap: 42px;
      padding-top: 32px;
      padding-bottom: 56px;
    }

    aside {
      border-left: 1px solid #cfc7ba;
      padding-left: 16px;
      align-self: start;
      position: sticky;
      top: 24px;
    }

    .toc-title {
      margin: 0 0 12px;
      color: #706a61;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .toc {
      display: grid;
      gap: 8px;
    }

    .toc a {
      color: #4d5f59;
      font-size: 0.92rem;
      line-height: 1.35;
    }

    .toc a:hover {
      color: #153e35;
    }

    article {
      min-width: 0;
    }

    .intro,
    .doc-section {
      border-bottom: 1px solid var(--rule);
    }

    .intro {
      padding-bottom: 30px;
    }

    .doc-section {
      scroll-margin-top: 32px;
      padding: 36px 0;
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 16px;
      margin-bottom: 18px;
    }

    h2 {
      font-size: 1.55rem;
      font-weight: 750;
    }

    .count {
      flex: none;
      color: #706a61;
      font-size: 0.9rem;
    }

    pre {
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
      color: #2c2b28;
      font-family: var(--mono);
      font-size: 0.91rem;
      line-height: 1.7;
    }

    @media (max-width: 900px) {
      .top-inner {
        align-items: stretch;
        flex-direction: column;
      }

      .formats {
        justify-content: flex-start;
      }

      .metrics {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .shell {
        display: block;
      }

      aside {
        display: none;
      }
    }

    @media (max-width: 560px) {
      .top-inner,
      .metrics,
      .shell {
        padding-left: 20px;
        padding-right: 20px;
      }

      h1 {
        font-size: 2rem;
      }

      .section-head {
        display: block;
      }

      .count {
        margin-top: 6px;
      }
    }
  </style>
</head>
<body>
  <header class="top">
    <div class="top-inner">
      <div>
        <a class="home" href="/">Docs Control</a>
        <h1>Sudowrite Documentation Roll-up</h1>
        <p class="lede">Complete public source generated from <code>docs-rollup.md</code> for agents, search tools, and internal reference.</p>
      </div>
      <nav class="formats" aria-label="Public docs formats">
        <a href="/public/raw">Raw Markdown</a>
        <a href="/api/docs?format=llmstxt">llms.txt</a>
        <a href="https://feedback.sudowrite.com/help">Help Center</a>
      </nav>
    </div>
  </header>

  <section class="metric-band">
    <dl class="metrics">
      <div><dt>Generated</dt><dd>${escapeHtml(generatedLabel)}</dd></div>
      <div><dt>Articles</dt><dd>${escapeHtml(summary.totalArticles?.toLocaleString() || 'Unknown')}</dd></div>
      <div><dt>Words</dt><dd>${escapeHtml(summary.wordCount.toLocaleString())}</dd></div>
      <div><dt>Characters</dt><dd>${escapeHtml(summary.characterCount.toLocaleString())}</dd></div>
    </dl>
  </section>

  <div class="shell">
    <aside>
      <p class="toc-title">Sections</p>
      <nav class="toc" aria-label="Roll-up sections">
        ${navItems}
      </nav>
    </aside>

    <article>
      <section class="intro">
        <h2>${escapeHtml(summary.title)}</h2>
        <pre>${escapeHtml(summary.introMarkdown)}</pre>
      </section>
      ${sections}
    </article>
  </div>
</body>
</html>`;
}

function renderSection(section: DocsRollupSection) {
  const count = section.articleCount > 0 ? `<p class="count">${escapeHtml(section.articleCount.toLocaleString())} articles</p>` : '';

  return `<section id="${section.id}" class="doc-section">
  <div class="section-head">
    <h2>${escapeHtml(section.title)}</h2>
    ${count}
  </div>
  <pre>${escapeHtml(section.markdown)}</pre>
</section>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTimestamp(value: string | null) {
  if (!value) return 'Unknown';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}
