---
name: polevka-backend
description: >-
  Hardens and reviews the Полёвка Secure API (cloud/api) and client sync for
  safety, data integrity, and latency. Use whenever changing auth, JWT, email,
  mail.json, sync/commit/presign, patchSound, Object Storage, rate limits,
  antispam, CORS, or DataContext polling — and when the user mentions backend,
  API, security, races, or “почини бэкенд”.
---

# Полёвка backend

Public product. Users are real people. Prefer fail-closed, lost-update resistance, and cheap reads over new features.

Code: `cloud/api/index.js`, `sessionSecurity.js`, `mailTemplates.js`. Client: `packages/core/src/api.ts`, `cloud.ts`, `apps/web/src/state/DataContext.tsx`. Rules: `.cursor/rules/email-roles-legal.mdc`, `docs/security.md`.

## Every change — run this list

1. **Writes are CAS or YDB rows.** S3: `mutateJson` / `mutateAuth` / `mutateMeta` (`If-Match`, 4 tries). YDB (when `YDB_DOCAPI_ENDPOINT` is set): one row per sound/user/mailbox; then publish public JSON cache. Never `load` + `save` a stale snapshot.
2. **HMAC fail-closed.** Integrity mismatch or corrupt JSON → 503, never merge against `[]`. Missing `.sig` on `INTEGRITY_KEYS` (catalog + auth) and `_mail/` → 503 `integrity_missing` unless `INTEGRITY_ALLOW_UNSIGNED=1`. Seal existing objects with `cloud/ops/seal-integrity.cjs`. YDB collection saves use BatchWriteItem (25); leftover unprocessed → do not publish public JSON.
3. **Partial sync.** Clients send changed rows only. Merge keeps cloud actor-sets; `forceActorInList` applies only the current login (staff included). Keyed lists union (comments, inbox). Last-writer-wins only for scalars with timestamps.
4. **Auth sessions.** Password change **and** reset bump `tokenVersion`. Login missing user = `401 bad_credentials` (same as wrong password). Do not reveal accounts.
5. **Email.** Codes only via SMTP. `emailVerified` only in `confirmEmailVerification`. One verified email → one login. Reset looks up **verified** email only. `persistActorPrivateMeta` must not steal another verified address.
6. **Consent.** Register requires `pdConsent`; store `pdConsent` / `pdConsentAt` in `private_meta`.
7. **Profiles.** Non-admin cannot insert `loginName` that is not already on the card (except self). Drop logins missing from `_auth` when the set is known.
8. **Uploads.** Presign requires `contentLength` **and binds it in the signed PUT**. Enforce 30 MB image / 1 GB audio. No `octet-stream` for media. No `_auth/` or root JSON keys. Non-staff sync ≤ 80 rows.
9. **Staff.** `admin` vs `moderator` vs `user`. TOTP before staff reads **or** writes mail/sync. Support bot is not a JWT role. `getMail`: admin=all boxes, moderator=own+`support`.
9a. **Account lifecycle.** `deleteAccount` (password + TOTP) and `adminDeleteUser` share `purgeAccountData`. Keep published media; delete drafts/uploads. `exportMyData` returns own profile/meta/mail/sounds/posts. Never self-delete `admin`/`support`.
10. **Spam.** Server cooldowns on sync / commit / mail / likes. Login/email/admin buckets persist in `_auth/rate_buckets.json` (hydrate on cold start). UI `spamGuardCheck` is not enough. Scale: `cloud/ops/set-scale-policy.ps1`.
11. **CORS.** Default origins: `polevka.art`, `www`, localhost. Not a wildcard GitHub Pages host.
12. **Logs.** No full SMTP/error objects (PII). Log `code` / `name` only.
13. **Reads.** Public JSON: `cache: 'no-cache'` (revalidate), not `?nocache=Date.now()`. Poll catalog ~90 s, mail ~20 s if logged in. Client fetch throws on !ok / timeout — never treat an outage as `[]`. DataContext keeps last catalog/mail; first-load down → ErrorScreen (crash / offline / unavailable).
14. **Secrets.** Never commit SMTP/JWT. Brand in mail: Полёвка / `noreply@polevka.art`.
15. **Errors.** `IntegrityError` → 503; `write_conflict` → 409. Client `apiSyncJson` retries 409.

## After editing API

- Bump `health.version` if the contract changed (current: **23**).
- Update `cloud/api/README.md` + `docs/security.md` when behavior changes.
- Deploy zip must include `index.js`, `sessionSecurity.js`, `mailTemplates.js`, `ydbDoc.js`, `mailCrypto.js`, `webPush.js`.
- If you add a write path, it must go through merge + sanitize + CAS (S3) or YDB row mutate + publish public JSON.
- When `YDB_DOCAPI_ENDPOINT` is set, YDB is source of truth; Object Storage public JSON is a cache. Do not invent a second write path.

## Do not

- Generate verification codes in the browser.
- Let `persistActorPrivateMeta` set `emailVerified`.
- Return empty JSON on integrity failure “to keep the app up”.
- Treat the JSON bucket as a database without retries.
- Frame work as “хватает для диплома”.
