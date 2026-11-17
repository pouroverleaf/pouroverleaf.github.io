// Computes the next biweekly session from a fixed anchor date.
// All times are Europe/London wall-clock, so BST/GMT changes are handled.
(function () {
  var ANCHOR = '2026-11-11';   // a session date (YYYY-MM-DD); every 14 days from here
  var PERIOD_DAYS = 14;
  var START = { h: 9, m: 0 };
  var END = { h: 11, m: 0 };
  // Session dates that do not happen (holidays, exams). Add as 'YYYY-MM-DD'.
  var SKIP = [];

  var DAY_MS = 86400000;
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  function dayNumber(iso) {
    var p = iso.split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]) / DAY_MS;
  }

  function isoFromDay(n) {
    return new Date(n * DAY_MS).toISOString().slice(0, 10);
  }

  function londonNow() {
    var parts = {};
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    return {
      day: dayNumber(parts.year + '-' + parts.month + '-' + parts.day),
      minutes: +parts.hour * 60 + +parts.minute
    };
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function hhmm(t) { return pad(t.h) + ':' + pad(t.m); }

  function longDate(day) {
    var d = new Date(day * DAY_MS);
    return WEEKDAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' +
      MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }

  // Returns { day, live } for the next session that has not ended yet.
  function nextSession(now) {
    var anchor = dayNumber(ANCHOR);
    var endMin = END.h * 60 + END.m;
    var startMin = START.h * 60 + START.m;
    var day = anchor;
    if (now.day > anchor) {
      day = anchor + Math.ceil((now.day - anchor) / PERIOD_DAYS) * PERIOD_DAYS;
    }
    if (day === now.day && now.minutes >= endMin) day += PERIOD_DAYS;
    while (SKIP.indexOf(isoFromDay(day)) !== -1) day += PERIOD_DAYS;
    return {
      day: day,
      live: day === now.day && now.minutes >= startMin && now.minutes < endMin
    };
  }

  function relative(now, s) {
    if (s.live) return 'happening now';
    var diff = s.day - now.day;
    if (diff === 0) return 'today';
    if (diff === 1) return 'tomorrow';
    return 'in ' + diff + ' days';
  }

  function render() {
    var now = londonNow();
    var s = nextSession(now);
    var dateEl = document.getElementById('next-date');
    var relEl = document.getElementById('next-rel');
    if (!dateEl) return;
    dateEl.textContent = longDate(s.day);
    dateEl.setAttribute('datetime', isoFromDay(s.day) + 'T' + hhmm(START));
    relEl.textContent = s.live ? 'Happening now' : '(' + relative(now, s) + ')';
    relEl.className = s.live ? 'live' : '';
  }

  render();
  setInterval(render, 60000);
})();
