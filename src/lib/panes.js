import { useEffect, useState } from 'react';

export const PANES = ['home', 'about', 'team', 'logs', 'gallery'];
export const COMMIT = 0.42; // drag further than this (in panes) and the move commits
const DURATION = 760;

// Shared transition state. Per-frame consumers read it directly; React reads `index` via usePaneIndex.
// index: current pane. offset: live drag in pane units (positive = toward the next pane).
// While animating: start → to over t∈[0,1] with a thunk (overshoot) ease. k0 = fraction of the way
// already covered by the drag at commit time.
const state = { index: 0, from: 0, to: 0, start: 0, t: 1, k0: 0, offset: 0, animating: false };
const listeners = new Set();
let springRaf = 0;

export const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
// Fast start, ~3% overshoot, settle. The "thunk".
export const thunk = (t) => {
  const c1 = 0.8, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const clampIndex = (i) => Math.max(0, Math.min(PANES.length - 1, i));

export function getTransition() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Continuous pane position for the sliding HTML panes.
export function position() {
  if (state.animating) return state.start + (state.to - state.start) * thunk(state.t);
  return state.index + state.offset;
}

// What per-frame layouts blend between. live=false means idle on pane a.
export function mix() {
  if (state.animating) {
    const k = state.k0 + (1 - state.k0) * thunk(state.t);
    return { a: state.from, b: state.to, k, t: state.k0 + (1 - state.k0) * state.t, live: true };
  }
  if (state.offset) {
    const b = clampIndex(state.index + Math.sign(state.offset));
    const k = Math.abs(state.offset);
    return { a: state.index, b, k, t: k, live: b !== state.index };
  }
  return { a: state.index, b: state.index, k: 1, t: 1, live: false };
}

function stopSpring() {
  cancelAnimationFrame(springRaf);
  springRaf = 0;
}

export function goTo(next) {
  next = clampIndex(next);
  if (state.animating || next === state.index) return;
  stopSpring();
  const dir = Math.sign(next - state.index);
  const o = state.offset * dir > 0 ? Math.min(Math.abs(state.offset), 0.95) : 0; // head start from a drag toward `next`
  state.from = state.index;
  state.to = next;
  state.start = state.index + state.offset;
  state.k0 = Math.abs(next - state.index) === 1 ? o : 0;
  state.offset = 0;
  state.index = next;
  state.t = 0;
  state.animating = true;
  history.replaceState(null, '', `#${PANES[next]}`);
  document.title = next === 0 ? 'pouroverleaf' : `${PANES[next]} · pouroverleaf`;
  const dur = DURATION * Math.sqrt(1 - state.k0);
  const begin = performance.now();
  const step = (now) => {
    state.t = clamp01((now - begin) / dur);
    if (state.t >= 1) state.animating = false;
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  listeners.forEach((fn) => fn(state.index));
}

// Live drag. offset is in pane units; past the ends it is rubber-banded.
export function setDrag(offset) {
  if (state.animating) return;
  stopSpring();
  const atStart = state.index === 0 && offset < 0;
  const atEnd = state.index === PANES.length - 1 && offset > 0;
  state.offset = atStart || atEnd ? Math.sign(offset) * Math.min(0.12, Math.abs(offset) * 0.25) : offset;
}

// Gesture ended: commit or spring back.
export function release() {
  if (state.animating || !state.offset) return;
  const dir = Math.sign(state.offset);
  const target = clampIndex(state.index + dir);
  if (Math.abs(state.offset) >= COMMIT && target !== state.index) return goTo(target);
  const o = state.offset;
  const begin = performance.now();
  const step = (now) => {
    const t = clamp01((now - begin) / 420);
    // critically damped: snaps back without crossing the rest position
    state.offset = t >= 1 ? 0 : o * (1 + 7 * t) * Math.exp(-7 * t);
    if (t < 1) springRaf = requestAnimationFrame(step);
    else springRaf = 0;
  };
  springRaf = requestAnimationFrame(step);
}

export function initFromHash() {
  const i = PANES.indexOf(location.hash.replace('#', '').replace('research', 'logs')); // old links
  if (i > 0) {
    state.index = state.from = state.to = state.start = i;
    document.title = `${PANES[i]} · pouroverleaf`;
  }
  // Debug: ?freeze=from,to,t holds a transition mid-way.
  const f = new URLSearchParams(location.search).get('freeze');
  if (f) {
    const [from, to, t] = f.split(',').map(Number);
    Object.assign(state, { from, to, start: from, t, k0: 0, index: to, animating: true });
  }
}

export function usePaneIndex() {
  const [index, setIndex] = useState(state.index);
  useEffect(() => subscribe(setIndex), []);
  return index;
}
