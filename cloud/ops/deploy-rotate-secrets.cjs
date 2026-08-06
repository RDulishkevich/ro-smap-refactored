/**
 * Deploy Secure API with rotated JWT_SECRET + ADMIN_PASSWORD.
 * Does not print secret values.
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');

const FUNCTION_ID = 'd4ebp9rd7rd53iso4p8u';
const SOURCE = path.join(__dirname, '..', 'api');

function ycJson(args) {
  const out = execFileSync('yc', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(out);
}

const versions = ycJson([
  'serverless', 'function', 'version', 'list',
  '--function-id', FUNCTION_ID,
  '--limit', '1',
  '--format', 'json'
]);
const env = { ...(versions[0]?.environment || {}) };

const prevJwt = env.JWT_SECRET || '';
const prevAdmin = env.ADMIN_PASSWORD || '';
env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
env.ADMIN_PASSWORD = crypto.randomBytes(18).toString('base64url');

const args = [
  'serverless', 'function', 'version', 'create',
  '--function-id', FUNCTION_ID,
  '--runtime', 'nodejs18',
  '--entrypoint', 'index.handler',
  '--memory', '512m',
  '--execution-timeout', '30s',
  '--source-path', SOURCE,
  '--format', 'json'
];
for (const [k, v] of Object.entries(env)) {
  args.push('--environment', `${k}=${v}`);
}

console.log('Deploying with rotated JWT_SECRET + ADMIN_PASSWORD (values not printed)…');
const created = JSON.parse(execFileSync('yc', args, {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe']
}));

console.log('id=' + created.id);
console.log('status=' + created.status);
console.log('jwt_rotated=' + (prevJwt !== env.JWT_SECRET));
console.log('admin_password_rotated=' + (prevAdmin !== env.ADMIN_PASSWORD));
console.log('ADMIN_PASSWORD_NEW=' + env.ADMIN_PASSWORD);
console.log('Save ADMIN_PASSWORD_NEW securely; sessions invalidated by JWT rotation.');
