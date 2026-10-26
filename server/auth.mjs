import { createRemoteJWKSet, jwtVerify } from 'jose';
import { HttpError } from './errors.mjs';

const remoteKeys = new Map();
const emailPattern = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

export function readAccessConfig(env) {
  const team = String(env.ACCESS_TEAM_DOMAIN || '').trim().toLowerCase().replace(/^https:\/\//, '').replace(/\/$/, '');
  const audience = String(env.ACCESS_AUD || '').split(',').map(value => value.trim()).filter(Boolean);
  const emails = String(env.ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/.test(team) || !audience.length || audience.some(value => !/^[a-zA-Z0-9_-]{16,256}$/.test(value)) || !emails.length || emails.some(value => !emailPattern.test(value))) {
    throw new HttpError(503, 'ADMIN_NOT_CONFIGURED', 'Administratoriaus prisijungimas dar neparuoštas.');
  }
  return { team, issuer: `https://${team}`, audience, emails: new Set(emails) };
}

/** The injected key set is only for isolated tests. Production always uses Access signing keys. */
export function createAccessVerifier({ jwks } = {}) {
  return async function verifyAccess(request, env) {
    const config = readAccessConfig(env);
    const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!assertion || assertion.length > 16384) {
      throw new HttpError(401, 'AUTH_REQUIRED', 'Prisijunkite administratoriaus paskyra.');
    }
    let keys = jwks;
    if (!keys) {
      if (!remoteKeys.has(config.team)) {
        remoteKeys.set(config.team, createRemoteJWKSet(new URL(`${config.issuer}/cdn-cgi/access/certs`), { timeoutDuration: 5000, cooldownDuration: 30000 }));
      }
      keys = remoteKeys.get(config.team);
    }
    let payload;
    try {
      ({ payload } = await jwtVerify(assertion, keys, {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: ['RS256'],
        requiredClaims: ['iss', 'aud', 'exp', 'iat', 'sub', 'email'],
        clockTolerance: 5,
        maxTokenAge: '24h',
      }));
    } catch {
      throw new HttpError(401, 'AUTH_INVALID', 'Prisijungimo sesija nebegalioja. Prisijunkite iš naujo.');
    }
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    if (!config.emails.has(email)) {
      throw new HttpError(403, 'ADMIN_FORBIDDEN', 'Ši paskyra neturi administratoriaus teisių.');
    }
    return { email };
  };
}

export const verifyAdminRequest = createAccessVerifier();

export function requireSameOriginMutation(request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get('Origin') !== origin || request.headers.get('X-CMS-Request') !== '1') {
    throw new HttpError(403, 'CSRF_REJECTED', 'Užklausa atmesta. Atnaujinkite administravimo puslapį.');
  }
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    throw new HttpError(403, 'CSRF_REJECTED', 'Užklausa atmesta. Atnaujinkite administravimo puslapį.');
  }
}
