import { SESSION, EVENTS } from './content';

const dayMs = 86400000;
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY = 3; // weekly session: Wednesday

function londonNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
  const day = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / dayMs;
  return { day, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

// "10:00–12:00" → [600, 720]. No time → the whole day.
function span(time) {
  const t = [...String(time || '').matchAll(/(\d{1,2}):(\d{2})/g)].map((m) => Number(m[1]) * 60 + Number(m[2]));
  return [t[0] ?? 0, t[1] ?? (t[0] != null ? t[0] + 120 : 24 * 60)];
}

function describe(day, time, now) {
  const [start, end] = span(time);
  const date = new Date(day * dayMs);
  const live = day === now.day && now.minutes >= start && now.minutes < end;
  const diff = day - now.day;
  return {
    day, start,
    iso: date.toISOString().slice(0, 10),
    label: `${weekdays[date.getUTCDay()]} ${date.getUTCDate()} ${months[date.getUTCMonth()]}`,
    live,
    relative: live ? 'happening now' : diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : `in ${diff} days`,
    ended: day < now.day || (day === now.day && now.minutes >= end),
  };
}

// The next `count` sessions, soonest first: the automatic weekly session merged with events.md.
// An event on a weekly-session day replaces that week's session.
export function getUpcoming(count = 2) {
  const now = londonNow();
  const events = EVENTS.map((e) => {
    const [y, m, d] = e.date.split('-').map(Number);
    return { kind: 'event', ...e, where: e.where || SESSION.where, ...describe(Date.UTC(y, m - 1, d) / dayMs, e.time, now) };
  }).filter((e) => !e.ended);
  const taken = new Set(events.map((e) => e.day));

  const weekly = [];
  const first = now.day + ((WEEKDAY - new Date(now.day * dayMs).getUTCDay() + 7) % 7);
  for (let day = first; weekly.length < count; day += 7) {
    const s = describe(day, SESSION.time, now);
    if (s.ended || taken.has(day)) continue;
    // session.md's theme and bean describe the coming week only.
    const thisWeek = weekly.length === 0;
    weekly.push({ kind: 'weekly', time: SESSION.time, where: SESSION.where, theme: thisWeek ? SESSION.theme : '', bean: thisWeek ? SESSION.bean : {}, image: null, ...s });
  }

  return [...events, ...weekly].sort((a, b) => a.day - b.day || a.start - b.start).slice(0, count);
}
