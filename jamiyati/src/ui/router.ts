import { useSyncExternalStore } from 'react';

function sub(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}
const get = () => window.location.hash.slice(1) || '/';

export function useRoute(): { path: string; parts: string[]; query: URLSearchParams } {
  const h = useSyncExternalStore(sub, get, get);
  const [path, qs] = h.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs) };
}

export function go(path: string, replace = false) {
  if (replace) window.location.replace('#' + path);
  else window.location.hash = path;
  window.scrollTo(0, 0);
}

export function back(fallback = '/') {
  if (window.history.length > 1) window.history.back();
  else go(fallback);
}
