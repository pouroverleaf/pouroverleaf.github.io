// All editable text lives in src/content/*.md. This file parses it into the shapes the components use.
import homeMd from '../content/home.md?raw';
import sessionMd from '../content/session.md?raw';
import siteMd from '../content/site.md?raw';
import eventsMd from '../content/events.md?raw';

// `key: value` lines between --- fences. Values are strings.
export function parseFront(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const meta = {};
  if (m) {
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':');
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return { meta, body: m ? m[2] : raw };
}

// First markdown table in `body` → objects keyed by header. Numeric cells become numbers. `\|` escapes a pipe.
export function parseTable(body) {
  const lines = body.split('\n').filter((l) => l.trim().startsWith('|'));
  if (lines.length < 2) return [];
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
  const head = cells(lines[0]);
  return lines.slice(2).map((l) => {
    const vals = cells(l);
    const o = {};
    head.forEach((h, i) => {
      const v = vals[i] ?? '';
      o[h] = v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v;
    });
    return o;
  });
}

const sorted = (mods) => Object.entries(mods).sort(([a], [b]) => a.localeCompare(b));
const slug = (path) => path.split('/').pop().replace(/\.md$/, '');

// home.md: the tagline, one line per line
export const HOME = { lines: homeMd.trim().split('\n') };

// session.md
const sm = parseFront(sessionMd).meta;
export const SESSION = {
  time: sm.time,
  where: sm.where,
  theme: sm.theme,
  bean: { farm: sm.bean, country: sm.country, process: sm.process, variety: sm.variety, roaster: sm.roaster, roasted: sm.roasted, notes: sm.notes },
};

// events.md: one-off events in a table; `image` names a file in events/.
const eventImages = import.meta.glob('../content/events/*.{jpg,jpeg,png,webp,gif}', { query: '?url', import: 'default', eager: true });
const imageByName = Object.fromEntries(Object.entries(eventImages).map(([path, url]) => [path.split('/').pop(), url]));
export const EVENTS = parseTable(parseFront(eventsMd).body)
  .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(String(e.date).trim()))
  .map((e) => ({
    date: String(e.date).trim(),
    time: String(e.time ?? ''),
    title: String(e.title ?? ''),
    where: String(e.where ?? ''),
    note: String(e.note ?? ''),
    image: e.image ? imageByName[String(e.image).trim()] ?? null : null,
  }));

// site.md
const si = parseFront(siteMd).meta;
export const SITE = { instagram: { handle: si.instagram, url: si.instagram_url } };

// team/*.md: one member per file, ordered by filename. Body is the bio. `spot` is where they stand in
// the group photo (static/img/team/Team.png), 1 = leftmost; it defaults to the file order.
const teamFiles = import.meta.glob('../content/team/*.md', { query: '?raw', import: 'default', eager: true });
export const TEAM = sorted(teamFiles).map(([path, text], i) => {
  const { meta, body } = parseFront(text);
  return { id: slug(path), name: meta.name, title: meta.title, color: meta.color, img: meta.img, spot: Number(meta.spot) || i + 1, bio: body.trim() };
});

// places/*.md: one globe layer per file with a table of points.
const ORDER = ['farms', 'labs', 'cafes'];
const placeFiles = import.meta.glob('../content/places/*.md', { query: '?raw', import: 'default', eager: true });
export const LAYERS = sorted(placeFiles)
  .map(([path, text]) => {
    const key = slug(path);
    const { meta, body } = parseFront(text);
    return { key, label: meta.label || key, color: meta.color, points: parseTable(body).map((p, i) => ({ ...p, id: `${key}-${i + 1}` })) };
  })
  .sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));

// gallery/*.{jpg,jpeg,png,webp,gif}: photos for the carousel, ordered by filename. alt = filename minus the number prefix.
const galleryFiles = import.meta.glob('../content/gallery/*.{jpg,jpeg,png,webp,gif}', { query: '?url', import: 'default', eager: true });
export const GALLERY = sorted(galleryFiles).map(([path, src], i) => {
  const id = path.split('/').pop().replace(/\.[^.]+$/, '');
  return { id, src, alt: id.replace(/^\d+[-_]?/, '').replace(/[-_]+/g, ' ') || `photo ${i + 1}` };
});
