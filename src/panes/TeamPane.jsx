import { useEffect, useRef, useState } from 'react';
import { TEAM } from '../lib/content';

// The group photo, in front of the globe (GlobeStage.jsx, outside the panes). Hovering a person
// (tapping, on touch) shows their card above them. People are matched by `spot` in team/*.md.
const PHOTO = '/img/team/Team.png';
// Where one person ends and the next begins, as fractions of the photo's width.
const SPLITS = [0, 0.233, 0.41, 0.585, 0.765, 1];
const BY_SPOT = [...TEAM].sort((a, b) => a.spot - b.spot);

// The photo's alpha channel, downsampled, so only pixels with a person on them count as a hover.
function useAlphaMask(src) {
  const mask = useRef(null);
  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      const w = 160, h = Math.round((160 * img.naturalHeight) / img.naturalWidth);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      mask.current = { w, h, data: ctx.getImageData(0, 0, w, h).data };
    };
  }, [src]);
  return mask;
}

function MemberCard({ m, spot }) {
  const left = ((SPLITS[spot] + SPLITS[spot + 1]) / 2) * 100;
  return (
    <div className="member-card box" style={{ left: `${left}%` }} role="status">
      <span className="avatar" style={{ background: m.color }}>
        {m.img ? <img src={m.img} alt="" /> : m.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
      </span>
      <div>
        <strong>{m.name}</strong>
        <em>{m.title}</em>
        {m.bio && <p>{m.bio}</p>}
      </div>
    </div>
  );
}

export default function TeamPane({ active }) {
  const [hover, setHover] = useState(-1); // index into BY_SPOT, -1 = nobody
  const mask = useAlphaMask(PHOTO);
  useEffect(() => { if (!active) setHover(-1); }, [active]);

  // Which person is under the pointer, or -1 over a transparent part of the photo.
  const personAt = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    const mk = mask.current;
    if (mk) {
      const x = Math.min(mk.w - 1, Math.max(0, (fx * mk.w) | 0)), y = Math.min(mk.h - 1, Math.max(0, (fy * mk.h) | 0));
      if (mk.data[(y * mk.w + x) * 4 + 3] < 40) return -1;
    }
    const i = SPLITS.findIndex((s, j) => j > 0 && fx < s) - 1;
    return i >= 0 && i < BY_SPOT.length ? i : -1;
  };

  return (
    <>
      <aside className="team-intro box">
        <p className="box-head">the committee</p>
        <p className="team-intro-line">Meet the team! <span className="fine">(hover over the photo)</span></p>
      </aside>
      <div className="team-photo">
        <img
          src={PHOTO}
          alt={`The committee: ${BY_SPOT.map((m) => m.name).join(', ')}`}
          draggable="false"
          className={hover >= 0 ? 'is-hovering' : ''}
          onPointerMove={(e) => { if (e.pointerType === 'mouse') setHover(personAt(e)); }}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(-1); }}
          onClick={(e) => { const i = personAt(e); setHover(i === hover ? -1 : i); }}
        />
        {hover >= 0 && <MemberCard key={hover} m={BY_SPOT[hover]} spot={hover} />}
      </div>
    </>
  );
}
