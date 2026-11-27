import { LOG_WHEEL } from '../lib/layout';

const HALF = 5; // maximum number of cards on each side of the selected log
const SLOTS = Array.from({ length: HALF * 2 + 1 }, (_, i) => i - HALF);
const STEP = Math.PI / 13;
const clamp01 = (n) => Math.max(0, Math.min(1, n));

export default function Roundtable({ logs, logIndex, onSelectLog }) {
  const n = logs.length;
  return (
    <div className="cards">
      {SLOTS.map((slot) => {
        if (!n || Math.abs(slot) > Math.ceil(n / 2)) return null;
        // Keep the same card mounted as it moves through the slots, including across a wrap.
        const position = logIndex + slot;
        const log = logs[((position % n) + n) % n];
        const angle = slot * STEP;
        const radius = 100 * LOG_WHEEL.radius;
        const opacity = clamp01(n / 2 + 0.5 - Math.abs(slot)) * clamp01(1 - (Math.abs(angle) - 1) / 0.22);
        return (
          <button
            key={position}
            type="button"
            inert={opacity < 0.3}
            className={`log-card box${slot === 0 ? ' is-selected' : ''}`}
            style={{
              left: `${100 * LOG_WHEEL.cx}vw`,
              top: `${100 * LOG_WHEEL.cy}vh`,
              transform: `translate(-50%, -50%) translate3d(${radius * Math.cos(angle)}vh, ${radius * Math.sin(angle)}vh, 0)`,
              opacity,
              zIndex: 10 - Math.abs(slot),
            }}
            onClick={() => onSelectLog(position)}
          >
            <span className="meta"><b>No.{log.n}</b> {log.dotted}</span>
            <span className="title">{log.title}</span>
          </button>
        );
      })}
    </div>
  );
}
