---
name: polevka-storage-ids
description: >-
  Object Storage layout and opaque IDs for Полёвка (usr_/snd_/media/ vs private
  auth). Use when changing buckets, keys, presign prefixes, userId migration,
  dual-read, or docs/storage-layout.md.
---

# Полёвка storage & IDs

Canonical layout: [`docs/storage-layout.md`](../../../docs/storage-layout.md).

## Must follow

1. **Private vs public.** Auth, mail, PII → `PRIVATE_BUCKET`. Published media + catalog cache → `BUCKET`.
2. **Opaque IDs.** New entities: `usr_`, `snd_`, `exp_`, `evt_`, `pst_` via `cloud/api/ids.js` / `@polevka/core` `newEntityId`.
3. **No login in new media paths.** Prefer `media/sounds/{soundId}/…`, `media/avatars/{userId}/…`. Legacy `uploads/{login}/` is dual-read only.
4. **Dual-read.** Until cutover, read legacy `_auth/users.json` / `uploads/` if new key missing; write new shape when touching a row.
5. **Presign whitelist.** Never sign `_auth/`, root JSON, or arbitrary keys. Allow `media/`, `uploads/`, `staging/`.
6. **Indexes.** Login and verified email map to `userId` (legacy: scan `private_meta` + auth keys).
7. **Deploy zip** must include `ids.js` when API uses it.

## Do not

- Put passwords or private_meta in the public bucket.
- Use display name / email as storage key.
- Big-bang delete of legacy keys without a migrate script in `cloud/ops/`.
