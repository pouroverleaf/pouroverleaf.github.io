import { marked } from 'marked';
import { renderSession } from './coffee-format';
import { COFFEE_PROFILES, parseFront } from './content';

export const TAGS = ['tasting', 'origin', 'experiment', 'creative', 'social'];

const files = import.meta.glob('../content/logs/*.md', { query: '?raw', import: 'default', eager: true });

function parse(path, raw) {
  const { meta, body } = parseFront(raw);
  return {
    id: path.split('/').pop().replace(/\.md$/, ''),
    title: meta.title || 'untitled',
    date: meta.date || '',
    author: meta.author || '',
    tags: meta.tags ? meta.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
    html: renderSession(body, COFFEE_PROFILES, text => marked.parse(text)),
  };
}

// Newest first. Same-date logs fall back to filename order so issue numbers are stable.
export const LOGS = Object.entries(files)
  .map(([path, raw]) => parse(path, raw))
  .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

// Issue numbers count up from the oldest log. Dates are shown Brutus-style: 2026.11.12
LOGS.forEach((log, i) => {
  log.n = String(LOGS.length - i).padStart(3, '0');
  log.dotted = log.date.replaceAll('-', '.');
});

export function byTag(tag) {
  return tag ? LOGS.filter((l) => l.tags.includes(tag)) : LOGS;
}
