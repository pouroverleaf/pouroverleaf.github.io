import { marked } from 'marked';

export const TAGS = ['coffee', 'research', 'meta research', 'fun'];

const files = import.meta.glob('../content/logs/*.md', { query: '?raw', import: 'default', eager: true });

function parse(path, raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta = {};
  if (m) {
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':');
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  const body = m ? m[2] : raw;
  return {
    id: path.split('/').pop().replace(/\.md$/, ''),
    title: meta.title || 'untitled',
    date: meta.date || '',
    author: meta.author || '',
    tags: meta.tags ? meta.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
    html: marked.parse(body),
  };
}

export const LOGS = Object.entries(files)
  .map(([path, raw]) => parse(path, raw))
  .sort((a, b) => (a.date < b.date ? 1 : -1));

// Issue numbers count up from the oldest log. Dates are shown Brutus-style: 2026.11.12
LOGS.forEach((log, i) => {
  log.n = String(LOGS.length - i).padStart(3, '0');
  log.dotted = log.date.replaceAll('-', '.');
});

export function byTag(tag) {
  return tag ? LOGS.filter((l) => l.tags.includes(tag)) : LOGS;
}
