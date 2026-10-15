const KEY = 'polevka_saved_sounds';

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* */ }
}

export function isSoundSaved(id: string | number) {
  return readIds().includes(String(id));
}

export function setSoundSaved(id: string | number, on: boolean): boolean {
  const key = String(id);
  const next = readIds().filter((x) => x !== key);
  if (on) next.unshift(key);
  writeIds(next);
  return on;
}

export function toggleSoundSaved(id: string | number) {
  const on = !isSoundSaved(id);
  setSoundSaved(id, on);
  return on;
}
