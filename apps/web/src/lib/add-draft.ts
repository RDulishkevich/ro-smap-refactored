const KEY = 'polevka_add_meta';

export type AddDraftMeta = {
  title?: string;
  desc?: string;
  location?: string;
  fxName?: string;
  kind?: string;
};

export function readAddDraft(): AddDraftMeta {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as AddDraftMeta;
  } catch {
    return {};
  }
}

export function writeAddDraft(next: AddDraftMeta) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* */ }
}

export function clearAddDraft() {
  try { localStorage.removeItem(KEY); } catch { /* */ }
}
