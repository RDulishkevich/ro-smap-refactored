import { apiDeletePushSubscription, apiPublicConfig, apiSavePushSubscription, type MailBox } from '@polevka/core';

const SEEN_KEY = 'polevka_mail_seen';

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) as string[] : []);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-400)));
  } catch { /* ignore */ }
}

function urlBase64ToUint8Array(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function ensureNotifyPermission() {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

export async function subscribeDevicePush() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    const cfg = await apiPublicConfig() as { vapidPublicKey?: string };
    const key = String(cfg.vapidPublicKey || '').trim();
    if (!key) return false;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }
    const json = sub.toJSON();
    const endpoint = String(json.endpoint || '');
    const p256dh = String(json.keys?.p256dh || '');
    const auth = String(json.keys?.auth || '');
    if (!endpoint || !p256dh || !auth) return false;
    await apiSavePushSubscription({ endpoint, keys: { p256dh, auth } });
    return true;
  } catch {
    return false;
  }
}

export async function unsubscribeDevicePush() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    try { await apiDeletePushSubscription(sub.endpoint); } catch { /* still drop local */ }
    await sub.unsubscribe();
  } catch { /* ignore */ }
}

export async function syncDevicePush(enabled: boolean) {
  if (!enabled) {
    await unsubscribeDevicePush();
    return false;
  }
  const ok = await ensureNotifyPermission();
  if (!ok) return false;
  return subscribeDevicePush();
}

export function seedSeenMail(boxes: MailBox[], me: string) {
  const self = String(me || '').toLowerCase();
  const seen = readSeen();
  if (seen.size) return;
  for (const m of boxes.find((b) => b.loginName === self)?.inbox || []) {
    if (m.id) seen.add(m.id);
  }
  writeSeen(seen);
}

export async function notifyNewMail(boxes: MailBox[], me: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const self = String(me || '').toLowerCase();
  const inbox = boxes.find((b) => b.loginName === self)?.inbox || [];
  const seen = readSeen();
  const fresh = inbox.filter((m) => {
    if (!m.id || m.deleted || seen.has(m.id)) return false;
    if (String(m.fromId || '').toLowerCase() === self) return false;
    const age = Date.now() - new Date(m.date).getTime();
    return Number.isFinite(age) && age < 15 * 60 * 1000;
  });
  if (!fresh.length) return;
  for (const m of fresh) seen.add(m.id);
  writeSeen(seen);
  const last = fresh[fresh.length - 1];
  const title = last.fromName || last.fromId || 'Полёвка';
  const body = last.video ? 'Видео' : (last.image ? (last.text || 'Фото') : (last.text || 'Новое сообщение'));
  const url = '/messages';
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready : null;
    if (reg?.showNotification) {
      await reg.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `dm-${last.fromId}`,
        data: { url },
      });
      return;
    }
  } catch { /* page Notification */ }
  try {
    new Notification(title, { body, icon: '/icon-192.png' });
  } catch { /* ignore */ }
}
