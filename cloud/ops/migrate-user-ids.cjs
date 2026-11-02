#!/usr/bin/env node
/**
 * Dual-write helper: ensure every _auth/users.json row has userId (usr_…).
 * Does NOT rewrite media keys yet — safe to run repeatedly (idempotent).
 *
 * Usage (with AWS env for private bucket, from cloud/api):
 *   node ../ops/migrate-user-ids.cjs --dry-run
 *   node ../ops/migrate-user-ids.cjs
 *
 * Prefer running via a one-off Function invoke in production; this script
 * documents the contract for agents (see polevka-storage-ids skill).
 */

const { newUserId } = require('../api/ids');

function migrateUsersObject(users) {
  const next = { ...(users && typeof users === 'object' ? users : {}) };
  let added = 0;
  for (const [login, row] of Object.entries(next)) {
    if (!row || typeof row !== 'object') continue;
    if (row.userId) continue;
    next[login] = { ...row, userId: newUserId() };
    added += 1;
  }
  return { users: next, added };
}

if (require.main === module) {
  const dry = process.argv.includes('--dry-run');
  console.log(JSON.stringify({
    ok: true,
    dry,
    note: 'Load _auth/users.json via API CAS, run migrateUsersObject, putJson back.',
    sample: migrateUsersObject({ demo: { salt: 'x', hash: 'y' } }),
  }, null, 2));
}

module.exports = { migrateUsersObject };
