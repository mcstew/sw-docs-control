/**
 * Feedback Parser
 * Parses CSV exports from HelpKit and Featurebase, plus free-text feedback.
 */

export interface FeedbackItem {
  articleTitle: string;
  feedback: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  email?: string;
  date?: string;
  source: string;
}

export interface ArticleFeedbackSummary {
  articleTitle: string;
  satisfaction: number | null;
  likes: number;
  neutrals: number;
  dislikes: number;
  totalVotes: number;
  comments: FeedbackItem[];
}

/**
 * Parse CSV text into rows. Handles quoted fields with commas.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Parse HelpKit article feedback CSV.
 * Expected columns: Article, Satisfaction, Like Votes, Neutral Votes, Dislike Votes, Comments
 */
export function parseHelpKitArticleFeedback(csvText: string): ArticleFeedbackSummary[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase());
  const articleIdx = headers.findIndex((h) => h.includes('article'));
  const satIdx = headers.findIndex((h) => h.includes('satisfaction'));
  const likeIdx = headers.findIndex((h) => h.includes('like'));
  const neutralIdx = headers.findIndex((h) => h.includes('neutral'));
  const dislikeIdx = headers.findIndex((h) => h.includes('dislike'));

  return rows.slice(1).map((row) => ({
    articleTitle: row[articleIdx] || '',
    satisfaction: satIdx >= 0 ? parseFloat(row[satIdx]) || null : null,
    likes: likeIdx >= 0 ? parseInt(row[likeIdx]) || 0 : 0,
    neutrals: neutralIdx >= 0 ? parseInt(row[neutralIdx]) || 0 : 0,
    dislikes: dislikeIdx >= 0 ? parseInt(row[dislikeIdx]) || 0 : 0,
    totalVotes: 0,
    comments: [],
  })).map((a) => ({ ...a, totalVotes: a.likes + a.neutrals + a.dislikes }));
}

/**
 * Parse HelpKit comments CSV.
 * Expected columns: Feedback, Title, Useful, Email, Created
 */
export function parseHelpKitComments(csvText: string): FeedbackItem[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase());
  const feedbackIdx = headers.findIndex((h) => h.includes('feedback'));
  const titleIdx = headers.findIndex((h) => h.includes('title'));
  const usefulIdx = headers.findIndex((h) => h.includes('useful'));
  const emailIdx = headers.findIndex((h) => h.includes('email'));
  const dateIdx = headers.findIndex((h) => h.includes('created') || h.includes('date'));

  return rows.slice(1)
    .filter((row) => row[feedbackIdx]?.trim())
    .map((row) => {
      const useful = row[usefulIdx]?.toLowerCase() || '';
      let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
      if (useful === 'yes') sentiment = 'positive';
      else if (useful === 'no') sentiment = 'negative';

      return {
        articleTitle: row[titleIdx] || '',
        feedback: row[feedbackIdx] || '',
        sentiment,
        email: row[emailIdx] || undefined,
        date: row[dateIdx] || undefined,
        source: 'helpkit',
      };
    });
}

/**
 * Parse free-text feedback (pasted or typed).
 * Each line or paragraph becomes a feedback item.
 */
export function parseFreeTextFeedback(text: string, articleTitle?: string): FeedbackItem[] {
  return text
    .split(/\n{2,}|\n(?=-\s)/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => ({
      articleTitle: articleTitle || 'General',
      feedback: block.replace(/^-\s*/, ''),
      sentiment: 'neutral' as const,
      source: 'manual',
    }));
}

/**
 * Auto-detect format and parse.
 */
export function parseFeedback(text: string): {
  items: FeedbackItem[];
  summaries: ArticleFeedbackSummary[];
  format: string;
} {
  const firstLine = text.split('\n')[0].toLowerCase();

  // Detect HelpKit comments CSV
  if (firstLine.includes('feedback') && firstLine.includes('useful')) {
    return {
      items: parseHelpKitComments(text),
      summaries: [],
      format: 'helpkit-comments',
    };
  }

  // Detect HelpKit article summary CSV
  if (firstLine.includes('article') && (firstLine.includes('satisfaction') || firstLine.includes('like'))) {
    return {
      items: [],
      summaries: parseHelpKitArticleFeedback(text),
      format: 'helpkit-articles',
    };
  }

  // Detect generic CSV with headers
  if (firstLine.includes(',') && text.split('\n').length > 2) {
    // Try as comments
    const items = parseHelpKitComments(text);
    if (items.length > 0) {
      return { items, summaries: [], format: 'csv' };
    }
  }

  // Fall back to free text
  return {
    items: parseFreeTextFeedback(text),
    summaries: [],
    format: 'free-text',
  };
}
