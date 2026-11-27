import { useSyncExternalStore } from 'react';

export const PANES = ['home', 'about', 'team', 'map', 'logs', 'gallery'];
const listeners = new Set();
let index = 0;

export const getPaneIndex = () => index;

export function paneClass(i, current) {
  if (i === current) return 'is-active';
  return i < current ? 'is-before' : 'is-after';
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function usePaneIndex() {
  return useSyncExternalStore(subscribe, getPaneIndex);
}

export function goTo(i) {
  const next = Math.max(0, Math.min(PANES.length - 1, i));
  if (next === index) return;
  index = next;
  history.replaceState(null, '', `#${PANES[index]}`);
  document.title = index === 0 ? 'pouroverleaf' : `${PANES[index]} · pouroverleaf`;
  listeners.forEach((fn) => fn());
}

const paneFromHash = () => PANES.indexOf(location.hash.replace('#', '').replace('research', 'logs')); // old links

export function initFromHash() {
  const i = paneFromHash();
  if (i > 0) {
    index = i;
    document.title = `${PANES[i]} · pouroverleaf`;
  }
  addEventListener('hashchange', () => {
    const next = paneFromHash();
    if (next >= 0) goTo(next);
  });
}
