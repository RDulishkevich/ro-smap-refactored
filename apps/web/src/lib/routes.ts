export type DeepRoute =
  | { kind: 'home' }
  | { kind: 'map' }
  | { kind: 'menu' }
  | { kind: 'catalog' }
  | { kind: 'feed' }
  | { kind: 'expeditions' }
  | { kind: 'events'; id?: string }
  | { kind: 'messages' }
  | { kind: 'settings' }
  | { kind: 'help' }
  | { kind: 'staff' }
  | { kind: 'guessr' }
  | { kind: 'profile' }
  | { kind: 'drafts' }
  | { kind: 'sound'; id: string }
  | { kind: 'user'; login: string };

export function parsePath(pathname: string): DeepRoute {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const head = String(parts[0] || '').toLowerCase();
  if (head === 's' && parts[1]) return { kind: 'sound', id: decodeURIComponent(parts[1]) };
  if (head === 'u' && parts[1]) return { kind: 'user', login: decodeURIComponent(parts[1]) };
  if (head === 'e' && parts[1]) return { kind: 'events', id: decodeURIComponent(parts[1]) };
  if (head === 'catalog' || head === 'library') return { kind: 'catalog' };
  if (head === 'feed') return { kind: 'feed' };
  if (head === 'expeditions') return { kind: 'expeditions' };
  if (head === 'events') return { kind: 'events', id: parts[1] ? decodeURIComponent(parts[1]) : undefined };
  if (head === 'messages' || head === 'mail') return { kind: 'messages' };
  if (head === 'settings') return { kind: 'settings' };
  if (head === 'help' || head === 'support') return { kind: 'help' };
  if (head === 'staff' || head === 'admin') return { kind: 'staff' };
  if (head === 'guessr' || head === 'guesser') return { kind: 'guessr' };
  if (head === 'profile' || head === 'cabinet') return { kind: 'profile' };
  if (head === 'drafts' || head === 'draft') return { kind: 'drafts' };
  if (head === 'menu') return { kind: 'menu' };
  if (head === 'map') return { kind: 'map' };
  return { kind: 'home' };
}

export function pathForSound(id: string | number) {
  return `/s/${encodeURIComponent(String(id))}`;
}

export function pathForUser(login: string) {
  return `/u/${encodeURIComponent(login.replace(/^@/, ''))}`;
}

export function pathForEvent(id: string) {
  return `/e/${encodeURIComponent(id)}`;
}

export function shareUrl(path: string) {
  return `${location.origin}${path}`;
}
