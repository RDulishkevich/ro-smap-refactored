import type { MailBox, MailMsg, MailReplyTo, Profile } from './types';

export const REACTION_EMOJIS = ['❤️', '👍', '😂', '🔥', '😮', '😢'] as const;

export function previewReply(reply?: MailReplyTo | null) {
  if (!reply) return '';
  if (reply.video) return 'Видео';
  if (reply.image) return reply.text || 'Фото';
  return String(reply.text || '');
}

export function toggleMailReaction(
  reactions: Record<string, string[]> | undefined,
  emoji: string,
  login: string,
): Record<string, string[]> {
  const self = String(login || '').toLowerCase();
  const next: Record<string, string[]> = {};
  for (const [key, users] of Object.entries(reactions || {})) {
    const list = (users || []).map((u) => String(u || '').toLowerCase()).filter((u) => u && u !== self);
    if (list.length) next[key] = list;
  }
  const had = (reactions?.[emoji] || []).some((u) => String(u || '').toLowerCase() === self);
  if (!had) next[emoji] = [...(next[emoji] || []), self];
  return next;
}

export function patchInboxMessage(
  boxes: MailBox[],
  boxLogin: string,
  msgId: string,
  patch: Partial<MailMsg>,
): MailBox[] {
  const key = String(boxLogin || '').toLowerCase();
  return boxes.map((b) => {
    if (b.loginName !== key) return b;
    return {
      ...b,
      inbox: (b.inbox || []).map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
    };
  });
}

export function messageHomeBox(me: string, peer: string, mine: boolean) {
  return mine ? String(peer || '').toLowerCase() : String(me || '').toLowerCase();
}

export const SUPPORT_LOGIN = 'support';
export const SUPPORT_NAME = 'Поддержка Полёвки';

export function normalizeMail(raw: unknown[]): MailBox[] {
  return (Array.isArray(raw) ? raw : []).map((row) => {
    const r = (row || {}) as MailBox;
    return {
      loginName: String(r.loginName || '').toLowerCase(),
      inbox: Array.isArray(r.inbox) ? r.inbox : [],
      notifications: Array.isArray(r.notifications) ? r.notifications : [],
      activityLog: Array.isArray(r.activityLog) ? r.activityLog : [],
    };
  }).filter((b) => b.loginName);
}

export function upsertInbox(boxes: MailBox[], login: string, msg: MailMsg, notif?: Record<string, unknown>): MailBox[] {
  const key = String(login || '').toLowerCase();
  const next = boxes.map((b) => ({ ...b, loginName: String(b.loginName || '').toLowerCase() }));
  const i = next.findIndex((b) => b.loginName === key);
  const row: MailBox = i >= 0 ? next[i] : { loginName: key, inbox: [], notifications: [], activityLog: [] };
  const updated: MailBox = {
    ...row,
    inbox: [msg, ...(row.inbox || [])].slice(0, 200),
    notifications: notif ? [notif, ...(row.notifications || [])].slice(0, 60) : (row.notifications || []),
  };
  if (i < 0) return [...next, updated];
  const copy = [...next];
  copy[i] = updated;
  return copy;
}

/** Only the mailbox that changed — server merge keeps the rest. */
export function upsertInboxPatch(boxes: MailBox[], login: string, msg: MailMsg, notif?: Record<string, unknown>): MailBox[] {
  const all = upsertInbox(boxes, login, msg, notif);
  const key = String(login || '').toLowerCase();
  return all.filter((b) => b.loginName === key);
}

export function threadWith(boxes: MailBox[], me: string, peer: string): Array<MailMsg & { mine: boolean }> {
  const self = String(me || '').toLowerCase();
  const other = String(peer || '').toLowerCase();
  const incoming = (boxes.find((b) => b.loginName === self)?.inbox || [])
    .filter((m) => String(m.fromId || '').toLowerCase() === other && !m.deleted)
    .map((m) => ({ ...m, mine: false }));
  const outgoing = (boxes.find((b) => b.loginName === other)?.inbox || [])
    .filter((m) => String(m.fromId || '').toLowerCase() === self && !m.deleted)
    .map((m) => ({ ...m, mine: true }));
  return [...incoming, ...outgoing].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function conversationPeers(boxes: MailBox[], me: string, profiles: Profile[]) {
  const self = String(me || '').toLowerCase();
  const peers = new Set<string>();
  peers.add(SUPPORT_LOGIN);
  const mine = boxes.find((b) => b.loginName === self);
  (mine?.inbox || []).forEach((m) => {
    const id = String(m.fromId || '').toLowerCase();
    if (id && id !== self) peers.add(id);
  });
  boxes.forEach((b) => {
    if (b.loginName === self) return;
    if ((b.inbox || []).some((m) => String(m.fromId || '').toLowerCase() === self && !m.deleted)) {
      peers.add(b.loginName);
    }
  });
  return [...peers].map((login) => {
    const p = profiles.find((x) => String(x.loginName || '').toLowerCase() === login);
    const lastIn = (mine?.inbox || []).filter((m) => String(m.fromId || '').toLowerCase() === login && !m.deleted)[0];
    const lastOut = (boxes.find((b) => b.loginName === login)?.inbox || [])
      .filter((m) => String(m.fromId || '').toLowerCase() === self && !m.deleted)[0];
    const last = [lastIn, lastOut].filter(Boolean).sort((a, b) => new Date(String(b?.date)).getTime() - new Date(String(a?.date)).getTime())[0];
    const unread = (mine?.inbox || []).filter((m) => String(m.fromId || '').toLowerCase() === login && !m.deleted && !m.read).length;
    return {
      login,
      name: login === SUPPORT_LOGIN ? SUPPORT_NAME : String(p?.displayName || p?.username || login),
      avatar: String(p?.avatar || ''),
      lastText: last?.deleted ? '' : previewMailText(last),
      lastDate: last?.date || '',
      unread,
    };
  }).sort((a, b) => new Date(b.lastDate || 0).getTime() - new Date(a.lastDate || 0).getTime());
}

export function markBoxNotificationsRead(boxes: MailBox[], login: string): { boxes: MailBox[]; patch: MailBox | null } {
  const key = String(login || '').toLowerCase();
  const box = boxes.find((b) => b.loginName === key);
  if (!box) return { boxes, patch: null };
  const list = box.notifications || [];
  if (!list.some((n) => !(n as { read?: boolean }).read)) return { boxes, patch: null };
  const patch: MailBox = {
    ...box,
    notifications: list.map((n) => ({ ...n, read: true })),
  };
  return {
    boxes: boxes.map((b) => (b.loginName === key ? patch : b)),
    patch,
  };
}

export function previewMailText(msg?: Partial<MailMsg> | null) {
  if (!msg) return '';
  if (msg.deleted) return '';
  if (msg.video) return 'Видео';
  if (msg.image) return msg.text ? String(msg.text) : 'Фото';
  return String(msg.text || '');
}

export function markThreadReadPatch(boxes: MailBox[], me: string, peer: string): MailBox | null {
  const self = String(me || '').toLowerCase();
  const other = String(peer || '').toLowerCase();
  const box = boxes.find((b) => b.loginName === self);
  if (!box) return null;
  let changed = false;
  const inbox = (box.inbox || []).map((m) => {
    if (String(m.fromId || '').toLowerCase() !== other || m.deleted || m.read) return m;
    changed = true;
    return { ...m, read: true, readAt: new Date().toISOString() };
  });
  const notifications = (box.notifications || []).map((n) => {
    const row = n as { fromId?: string; type?: string; read?: boolean };
    if (String(row.fromId || '').toLowerCase() !== other || row.type !== 'message' || row.read) return n;
    changed = true;
    return { ...n, read: true };
  });
  if (!changed) return null;
  return { ...box, inbox, notifications };
}

export function makeMailMsg(fromId: string, fromName: string, text: string, extra: Partial<MailMsg> = {}): MailMsg {
  return {
    id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    fromId,
    fromName,
    text,
    date: new Date().toISOString(),
    read: false,
    ...extra,
  };
}
