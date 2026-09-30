export type DeepRoute =
  | { kind: 'home' }
  | { kind: 'sound'; id: string }
  | { kind: 'user'; login: string }
  | { kind: 'event'; id: string };

export function parsePath(pathname: string): DeepRoute {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (parts[0] === 's' && parts[1]) return { kind: 'sound', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'u' && parts[1]) return { kind: 'user', login: decodeURIComponent(parts[1]) };
  if (parts[0] === 'e' && parts[1]) return { kind: 'event', id: decodeURIComponent(parts[1]) };
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
