import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createAccessVerifier, readAccessConfig, requireSameOriginMutation } from '../server/auth.mjs';

const env = { ACCESS_TEAM_DOMAIN: 'cms-tests.cloudflareaccess.com', ACCESS_AUD: 'a'.repeat(64), ADMIN_EMAILS: 'admin@example.test' };
const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
const jwk = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' };
const verify = createAccessVerifier({ jwks: createLocalJWKSet({ keys: [jwk] }) });

async function token(overrides = {}, signer = privateKey) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: 'admin@example.test', ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(overrides.iss || `https://${env.ACCESS_TEAM_DOMAIN}`)
    .setAudience(overrides.aud || env.ACCESS_AUD)
    .setSubject('user-test')
    .setIssuedAt(now)
    .setExpirationTime(overrides.exp ?? now + 3600)
    .sign(signer);
}
const request = assertion => new Request('https://bukarciau.lt/admin/api/state', { headers: assertion ? { 'Cf-Access-Jwt-Assertion': assertion } : {} });

test('Access fails closed without a complete valid configuration', () => {
  for (const config of [{}, { ...env, ADMIN_EMAILS: '' }, { ...env, ACCESS_AUD: '' }, { ...env, ACCESS_TEAM_DOMAIN: 'attacker.test' }, { ...env, ADMIN_EMAILS: 'everyone' }]) {
    assert.throws(() => readAccessConfig(config), error => error.status === 503);
  }
  assert.equal(readAccessConfig({ ...env, ADMIN_EMAILS: 'ADMIN@example.test, second@example.test' }).emails.size, 2);
});

test('Access requires a signed assertion rather than a cookie or claimed email header', async () => {
  await assert.rejects(verify(request(), env), error => error.status === 401);
  const spoof = new Request(request(), { headers: { Cookie: `CF_Authorization=${await token()}`, 'Cf-Access-Authenticated-User-Email': 'admin@example.test' } });
  await assert.rejects(verify(spoof, env), error => error.status === 401);
  await assert.rejects(verify(request('invalid-token'), env), error => error.status === 401);
});

test('Access accepts only a correctly signed, unexpired token for the exact application and allowlist', async () => {
  assert.deepEqual(await verify(request(await token()), env), { email: 'admin@example.test' });
  assert.deepEqual(await verify(request(await token({ email: 'ADMIN@example.test' })), env), { email: 'admin@example.test' });
  for (const claims of [{ aud: 'b'.repeat(64) }, { iss: 'https://attacker.cloudflareaccess.com' }, { exp: Math.floor(Date.now() / 1000) - 60 }]) {
    await assert.rejects(verify(request(await token(claims)), env), error => error.status === 401);
  }
  await assert.rejects(verify(request(await token({ email: 'other@example.test' })), env), error => error.status === 403);
  await assert.rejects(verify(request(await token({ email: null })), env), error => error.status === 403);
  const otherKeys = await generateKeyPair('RS256');
  await assert.rejects(verify(request(await token({}, otherKeys.privateKey)), env), error => error.status === 401);
});

test('Access rejects unsigned algorithm substitution and missing expiry', async () => {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'none' })}.${encode({ email: 'admin@example.test', iss: `https://${env.ACCESS_TEAM_DOMAIN}`, aud: env.ACCESS_AUD, exp: Math.floor(Date.now() / 1000) + 3600 })}.`;
  await assert.rejects(verify(request(unsigned), env), error => error.status === 401);
  const noExpiry = await new SignJWT({ email: 'admin@example.test' }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setIssuer(`https://${env.ACCESS_TEAM_DOMAIN}`).setAudience(env.ACCESS_AUD).setSubject('user-test').setIssuedAt().sign(privateKey);
  await assert.rejects(verify(request(noExpiry), env), error => error.status === 401);
});

test('Every mutation requires the exact origin and the dedicated request header', () => {
  const mutation = headers => new Request('https://bukarciau.lt/admin/api/draft', { method: 'POST', headers });
  assert.doesNotThrow(() => requireSameOriginMutation(mutation({ Origin: 'https://bukarciau.lt', 'X-CMS-Request': '1', 'Sec-Fetch-Site': 'same-origin' })));
  for (const headers of [{}, { Origin: 'https://attacker.test', 'X-CMS-Request': '1' }, { Origin: 'https://bukarciau.lt' }, { Origin: 'null', 'X-CMS-Request': '1' }, { Origin: 'https://bukarciau.lt', 'X-CMS-Request': '1', 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.throws(() => requireSameOriginMutation(mutation(headers)), error => error.status === 403 && error.code === 'CSRF_REJECTED');
  }
});
