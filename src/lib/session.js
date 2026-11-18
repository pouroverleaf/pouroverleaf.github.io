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

// Next Wednesday 10:00–12:00 Europe/London.
export function getNextSession() {
  const now = londonNow();
  const weekday = new Date(now.day * dayMs).getUTCDay();
  let day = now.day + ((3 - weekday + 7) % 7);
  if (day === now.day && now.minutes >= 720) day += 7;
  const live = day === now.day && now.minutes >= 600 && now.minutes < 720;
  const date = new Date(day * dayMs);
  const diff = day - now.day;
  return {
    iso: new Date(day * dayMs).toISOString().slice(0, 10),
    label: `${weekdays[date.getUTCDay()]} ${date.getUTCDate()} ${months[date.getUTCMonth()]}`,
    live,
    relative: live ? 'happening now' : diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : `in ${diff} days`,
  };
}
