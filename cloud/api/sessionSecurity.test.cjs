const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { pickAccessToken } = require('./sessionSecurity');

function jwt(aud) {
  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${enc({ alg: 'none' })}.${enc(aud ? { aud } : {})}.sig`;
}

describe('pickAccessToken', () => {
  it('keeps cookie-first when none are staff', () => {
    assert.equal(pickAccessToken('cookie', 'header', 'body'), 'cookie');
  });

  it('prefers a staff JWT over a stale site cookie', () => {
    const staff = jwt('staff');
    const site = jwt('');
    assert.equal(pickAccessToken(site, staff, ''), staff);
    assert.equal(pickAccessToken(site, '', staff), staff);
  });
});
