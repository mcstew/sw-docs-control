import { readFile } from 'fs/promises';
import path from 'path';

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
  return readFile(path.join(process.cwd(), 'docs-rollup.md'), 'utf8');
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
