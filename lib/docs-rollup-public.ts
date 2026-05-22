import { readFile } from 'fs/promises';
import path from 'path';

const REPO_OWNER = 'sudowrite';
const REPO_NAME = 'docs-control';
const BRANCH = 'main';
const ROLLUP_PATH = 'docs-rollup.md';
const SECTION_HEADING = /^# (.+)$/;
const GENERATED = /^> Generated:\s*(.+)$/m;
const TOTAL_ARTICLES = /^> Total Articles:\s*(\d+)$/m;
const SLUG_LINE = /^\*\*Slug:\*\*/gm;

export type DocsRollupSection = {
  title: string;
  id: string;
  markdown: string;
  articleCount: number;
};

export type DocsRollupSummary = {
  title: string;
  generatedAt: string | null;
  totalArticles: number | null;
  wordCount: number;
  characterCount: number;
  introMarkdown: string;
  sections: DocsRollupSection[];
};

export async function readDocsRollup() {
  if (process.env.VERCEL || process.env.DOCS_ROLLUP_SOURCE === 'github') {
    try {
      return await readGithubDocsRollup();
    } catch (error) {
      console.warn('[public-docs] Falling back to bundled docs-rollup.md:', (error as Error).message);
    }
  }

  return readFile(path.join(process.cwd(), 'docs-rollup.md'), 'utf8');
}

async function readGithubDocsRollup() {
  const token = process.env.GITHUB_TOKEN;
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${ROLLUP_PATH}?ref=${BRANCH}`,
    {
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'docs-control-public-rollup',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );

  if (!res.ok) {
    throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  }

  const data: any = await res.json();
  if (!data?.content) {
    throw new Error('GitHub response did not include file content');
  }

  return Buffer.from(String(data.content), 'base64').toString('utf8');
}

export function parseDocsRollup(markdown: string): DocsRollupSummary {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const title = lines.find((line) => line.startsWith('# '))?.replace(/^# /, '').trim() || 'Sudowrite Documentation';
  const generatedAt = normalized.match(GENERATED)?.[1]?.trim() || null;
  const totalArticlesMatch = normalized.match(TOTAL_ARTICLES)?.[1];
  const totalArticles = totalArticlesMatch ? Number(totalArticlesMatch) : null;
  const sections: DocsRollupSection[] = [];
  const introLines: string[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const heading = line.match(SECTION_HEADING);

    if (heading && heading[1].trim() !== title && isRollupSectionHeading(lines, index)) {
      if (current) {
        sections.push(toSection(current.title, current.lines.join('\n')));
      }
      current = { title: heading[1].trim(), lines: [] };
      continue;
    }

    if (current) {
      current.lines.push(line);
    } else if (line.trim() !== `# ${title}`) {
      introLines.push(line);
    }
  }

  if (current) {
    sections.push(toSection(current.title, current.lines.join('\n')));
  }

  return {
    title,
    generatedAt,
    totalArticles,
    wordCount: normalized.trim().split(/\s+/).filter(Boolean).length,
    characterCount: normalized.length,
    introMarkdown: introLines.join('\n').trim(),
    sections,
  };
}

function isRollupSectionHeading(lines: string[], index: number) {
  const title = lines[index].replace(/^# /, '').trim();
  if (title === 'End of Documentation') return true;

  const nextMeaningfulLine = lines.slice(index + 1).find((line) => line.trim().length > 0);
  return nextMeaningfulLine === '---';
}

function toSection(title: string, markdown: string): DocsRollupSection {
  return {
    title,
    id: slugify(title),
    markdown: markdown.trim(),
    articleCount: markdown.match(SLUG_LINE)?.length || 0,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'section';
}
