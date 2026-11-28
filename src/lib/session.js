import { SESSION, EVENTS } from './content';

const dayMs = 86400000;
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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

export function getNextSession() {
  const now = londonNow();
  const [event] = EVENTS.map((e) => ({
    kind: 'event', ...e, where: e.where || SESSION.where, ...describe(Date.parse(e.date) / dayMs, e.time, now),
  })).filter((e) => !e.ended).sort((a, b) => a.day - b.day || a.start - b.start);

  const monday = now.day - (new Date(now.day * dayMs).getUTCDay() + 6) % 7;
  const override = Date.parse(SESSION.date) / dayMs;
  for (let week = monday; ; week += 7) {
    // An explicit date moves only that week's Wednesday session.
    const day = override >= week && override < week + 7 ? override : week + 2;
    if (event && event.day <= day) return event;
    const s = describe(day, SESSION.time, now);
    if (!s.ended && !EVENTS.some((e) => e.date === s.iso)) {
      return { kind: 'weekly', time: SESSION.time, where: SESSION.where, theme: SESSION.theme, bean: SESSION.bean, image: null, ...s };
    }
  }
}
