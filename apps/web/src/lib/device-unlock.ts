import { DEVICE_UNLOCK_KEY } from '@polevka/core';

type StoredUnlock = { login: string; id: string };

function rpId() {
  const host = location.hostname;
  if (host === 'www.polevka.art' || host === 'polevka.art') return 'polevka.art';
  return host;
}

function bufToB64url(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBuf(value: string) {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function readDeviceUnlock(): StoredUnlock | null {
  try {
    const raw = localStorage.getItem(DEVICE_UNLOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUnlock;
    if (!parsed?.login || !parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDeviceUnlock() {
  try { localStorage.removeItem(DEVICE_UNLOCK_KEY); } catch { /* ignore */ }
}

export async function canUseDeviceUnlock() {
  if (typeof window === 'undefined' || !window.isSecureContext) return false;
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function hasDeviceUnlock() {
  return !!readDeviceUnlock();
}

export async function enrollDeviceUnlock(login: string, displayName?: string) {
  if (!(await canUseDeviceUnlock())) throw Object.assign(new Error('unavailable'), { code: 'webauthn_unavailable' });
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Полёвка', id: rpId() },
      user: {
        id: new TextEncoder().encode(login.toLowerCase()),
        name: login,
        displayName: displayName || login,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'required',
        requireResidentKey: true,
      },
      timeout: 60_000,
      attestation: 'none',
    },
  });
  if (!cred || cred.type !== 'public-key') throw Object.assign(new Error('webauthn'), { code: 'webauthn_failed' });
  const id = bufToB64url((cred as PublicKeyCredential).rawId);
  localStorage.setItem(DEVICE_UNLOCK_KEY, JSON.stringify({ login: login.toLowerCase(), id }));
}

export async function watchConditionalUnlock(signal?: AbortSignal) {
  const PK = window.PublicKeyCredential;
  if (!PK || typeof PK.isConditionalMediationAvailable !== 'function') return null;
  try {
    if (!(await PK.isConditionalMediationAvailable())) return null;
  } catch {
    return null;
  }
  const stored = readDeviceUnlock();
  const cred = await navigator.credentials.get({
    mediation: 'conditional',
    signal,
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: rpId(),
      userVerification: 'preferred',
    },
  });
  if (!cred || cred.type !== 'public-key') return null;
  return stored || readDeviceUnlock();
}

export async function assertDeviceUnlock() {
  const stored = readDeviceUnlock();
  if (!stored) throw Object.assign(new Error('no_device'), { code: 'webauthn_missing' });
  const cred = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: rpId(),
      allowCredentials: [{ type: 'public-key', id: b64urlToBuf(stored.id) }],
      userVerification: 'required',
      timeout: 60_000,
    },
  });
  if (!cred || cred.type !== 'public-key') throw Object.assign(new Error('webauthn'), { code: 'webauthn_failed' });
  return stored;
}
