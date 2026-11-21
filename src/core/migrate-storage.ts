// One-time move of localStorage keys from the app's old name (puzzle express) to puzzle feed, so
// profiles, saves and settings survive the rename. Imported first in main.ts: it must run before any
// module reads storage. Safe to delete once old installs have had time to load a new version.
const OLD = 'puzzle-express:';
const NEW = 'puzzle-feed:';

try {
  const old: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(OLD)) old.push(k);
  }
  for (const k of old) {
    const to = NEW + k.slice(OLD.length);
    const v = localStorage.getItem(k);
    if (v !== null && localStorage.getItem(to) === null) localStorage.setItem(to, v);
    localStorage.removeItem(k);
  }
} catch {
  // Storage unavailable (private mode, quota): nothing to migrate.
}
