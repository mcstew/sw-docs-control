/**
 * Generate llms.txt and docs-rollup.md from article data.
 * Works with articles from any source (GitHub API or local filesystem).
 */

const COLLECTION_NAMES: Record<string, { main: string; sub: string | null }> = {
  '7475072': { main: 'Getting Started', sub: 'Introduction' },
  '6149413': { main: 'Getting Started', sub: 'Sudowrite Manual' },
  '6550900': { main: 'Plans And Account', sub: 'Sudowrite Plans' },
  '5445363': { main: 'Plans And Account', sub: 'Credits' },
  '4304666': { main: 'Plans And Account', sub: 'Your Account' },
  '5442133': { main: 'Using Sudowrite', sub: 'Features' },
  '5279540': { main: 'Using Sudowrite', sub: 'Workflows' },
  '9773420': { main: 'Using Sudowrite', sub: 'Story Bible' },
  '5566496': { main: 'Using Sudowrite', sub: 'Story Smarts' },
  '2165317': { main: 'Using Sudowrite', sub: 'Plugins' },
  '4553298': { main: 'Using Sudowrite', sub: 'Sudowrite Mobile App' },
  '5844132': { main: 'Resources', sub: 'Classes' },
  '8291256': { main: 'Resources', sub: 'Community' },
  '4621459': { main: 'Frequently Asked Questions', sub: null },
  '4964533': { main: 'Legal Stuff', sub: 'The Fine Print' },
  '8861565': { main: 'About Sudowrite', sub: 'More About Us' },
};

const SECTION_ORDER = [
  'Getting Started',
  'Plans And Account',
  'Using Sudowrite',
  'Resources',
  'Frequently Asked Questions',
  'Legal Stuff',
  'About Sudowrite',
];

interface Article {
  title: string;
  slug: string;
  category: string;
  content: string;
  last_updated?: string;
  id?: string;
}

function getCollection(category: string) {
  return COLLECTION_NAMES[category] || { main: 'Uncategorized', sub: null };
}

function getDescription(content: string): string {
  const lines = content.split('\n').filter((l) => l.trim());
  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('<') || line.startsWith('>') || line.startsWith('!')) continue;
    const cleaned = line.replace(/[*_]/g, '').trim();
    if (cleaned.length > 10) {
      return cleaned.length > 100 ? cleaned.substring(0, 97) + '...' : cleaned;
    }
  }
  return 'Documentation article';
}

function groupBySection(articles: Article[]) {
  const grouped = new Map<string, Map<string, Article[]>>();

  for (const article of articles) {
    const { main, sub } = getCollection(article.category);
    if (!grouped.has(main)) grouped.set(main, new Map());
    const subKey = sub || 'General';
    const subMap = grouped.get(main)!;
    if (!subMap.has(subKey)) subMap.set(subKey, []);
    subMap.get(subKey)!.push(article);
  }

  return grouped;
}

export function generateLlmsTxt(articles: Article[]): string {
  const baseUrl = 'https://feedback.sudowrite.com/help';
  const grouped = groupBySection(articles);

  let content = `# Sudowrite Documentation\n\n`;
  content += `> AI-optimized documentation for Sudowrite, the AI writing assistant for creative fiction authors.\n\n`;
  content += `## Documentation Sections\n\n`;

  for (const section of SECTION_ORDER) {
    const subMap = grouped.get(section);
    if (!subMap) continue;

    content += `### ${section}\n\n`;

    for (const [subKey, subArticles] of subMap) {
      if (subKey !== 'General') {
        content += `**${subKey}:**\n\n`;
      }
      for (const article of subArticles) {
        const url = `${baseUrl}/articles/${article.slug}`;
        content += `- [${article.title}](${url}): ${getDescription(article.content)}\n`;
      }
      content += '\n';
    }
  }

  content += `## Additional Resources\n\n`;
  content += `- Website: https://www.sudowrite.com\n`;
  content += `- Support: hi@sudowrite.com\n`;
  content += `- Community: https://discord.gg/sudowrite\n\n`;
  content += `---\n\n*Last updated: ${new Date().toISOString()}*\n*Total articles: ${articles.length}*\n`;

  return content;
}

export function generateDocsRollup(articles: Article[]): string {
  const grouped = groupBySection(articles);

  let content = `# Sudowrite Documentation - Complete Knowledge Base\n\n`;
  content += `> Generated: ${new Date().toISOString()}\n`;
  content += `> Total Articles: ${articles.length}\n\n`;
  content += `---\n\n`;

  for (const section of SECTION_ORDER) {
    const subMap = grouped.get(section);
    if (!subMap) continue;

    content += `\n\n# ${section}\n\n---\n\n`;

    for (const [subKey, subArticles] of subMap) {
      if (subKey !== 'General') {
        content += `## ${subKey}\n\n`;
      }
      for (const article of subArticles) {
        const col = getCollection(article.category);
        content += `### ${article.title}\n\n`;
        content += `**Collection:** ${col.main}${col.sub ? ' > ' + col.sub : ''}\n`;
        content += `**Slug:** ${article.slug}\n`;
        if (article.id) content += `**ID:** ${article.id}\n`;
        content += `**Last Updated:** ${article.last_updated || 'Unknown'}\n\n`;
        content += article.content;
        content += '\n\n---\n\n';
      }
    }
  }

  content += `\n\n# End of Documentation\n\nTotal articles: ${articles.length}\n`;

  return content;
}
