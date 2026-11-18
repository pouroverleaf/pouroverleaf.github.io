import { useEffect, useState } from 'react';

const papers = [
  ['2611.0005', 'cs.CL', 'Robust speech recognition for Scottish English accents with limited labelled data', 'A. Student, B. Student'],
  ['2611.0004', 'cs.RO', 'Learning bipedal gaits from ten minutes of real-world data', 'C. Student'],
  ['2611.0003', 'cs.PL', 'Verified compilation of a small language with effect handlers', 'D. Student, E. Student, F. Student'],
  ['2611.0002', 'cs.LG', 'Sparse attention for long-context retrieval on a single GPU', 'G. Student'],
  ['2611.0001', 'physics.flu-dyn', 'Extraction yield as a function of grind size distribution in V60 brewing', 'H. Student, I. Student'],
];

function SessionDetails() {
  const [session, setSession] = useState(getNextSession);

  useEffect(() => {
    const update = () => setSession(getNextSession());
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section>
      <h2>Sessions</h2>
      <dl className="meta">
        <dt>When</dt><dd>Every Wednesday, 09:00–11:00</dd>
        <dt>Where</dt><dd>Appleton Tower, Level 4</dd>
        <dt>Next session</dt>
        <dd>
          <time id="next-date" dateTime={`${session.iso}T09:00`}>{session.label}</time>
          <span id="next-rel" className={session.live ? 'live' : ''}>
            {session.live ? 'Happening now' : `(${session.relative})`}
          </span>
        </dd>
      </dl>
    </section>
  );
}

function DemoPapers() {
  return (
    <section className="papers">
      <h2>Recently shared <span className="demo-tag">demo</span></h2>
      <ol className="paper-list">
        {papers.map(([id, category, title, authors]) => (
          <li key={id}>
            <div className="paper-id">pol:{id} · {category} · <a href="#">pdf</a> · <a href="#">abs</a></div>
            <div className="paper-title">{title}</div>
            <div className="paper-authors">{authors}</div>
          </li>
        ))}
      </ol>
      <p className="demo-note">Example entries. Remove ?demo=true from the URL to hide them.</p>
    </section>
  );
}

export default function Home() {
  const [showDemo] = useState(() => new URLSearchParams(window.location.search).get('demo') === 'true');

  return (
    <>
      <section className="hero">
        <video className="hero-video" autoPlay muted loop playsInline poster="/img/banner.jpg" aria-hidden="true">
          <source src="/video/Coffeevideo.mp4" type="video/mp4" />
        </video>
        <div className="hero-shade" />
        <div className="hero-content">
          <h1>Coffee, Tea,<br />and research!</h1>
          <p className="hero-intro">School of Informatics · University of Edinburgh</p>
          <div className="session-card">
            <span className="session-label">next session</span>
            <SessionDetails />
          </div>
        </div>
        <div className="hero-theme">
          <img src="/img/theme.svg" alt="This week's theme: iced drinks" width="377" height="496" />
        </div>
        <a className="scroll-cue" href="#about">scroll to explore <span aria-hidden="true">↓</span></a>
      </section>
      <main className="home-content inner" id="about">
        <section className="intro">
          <p className="eyebrow">01 / about</p>
          <div>
            <h2>Half Caffeine club,<br />Half research club.</h2>
            <p className="lede">We brew specialty drinks and talk about interesting research papers.</p>
          </div>
        </section>
        <section className="home-note">
          <p className="eyebrow">02 / come along</p>
          <h2>Bring a paper.<br />Bring a project.<br />Bring a cup!</h2>
          <a className="text-link" href="/about/">learn more <span aria-hidden="true">↗</span></a>
        </section>
        {showDemo && <DemoPapers />}
      </main>
    </>
  );
}

const dayMs = 86400000;
const weekDays = 7;
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function dayNumber(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / dayMs;
}

function isoFromDay(day) {
  return new Date(day * dayMs).toISOString().slice(0, 10);
}

function londonNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
  return { day: dayNumber(`${parts.year}-${parts.month}-${parts.day}`), minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

function getNextSession() {
  const now = londonNow();
  const currentWeekday = new Date(now.day * dayMs).getUTCDay();
  let day = now.day + ((3 - currentWeekday + 7) % 7);
  if (day === now.day && now.minutes >= 660) day += weekDays;

  const live = day === now.day && now.minutes >= 540 && now.minutes < 660;
  const date = new Date(day * dayMs);
  const diff = day - now.day;
  return {
    iso: isoFromDay(day),
    label: `${weekdays[date.getUTCDay()]} ${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
    live,
    relative: diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : `in ${diff} days`,
  };
}
