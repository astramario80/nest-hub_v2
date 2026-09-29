import { bridge, districtEmail, validToken } from './nest-auth.mjs';
export const SIGNAL_ROLES = new Set(['assistant manager', 'division manager', 'chief executive officer', 'chief financial officer', 'chief operations officer']);
export function leadershipAllowsSignals(email, leaders) {
  const normalized = districtEmail(email);
  if (!normalized) return false;
  if (normalized.endsWith('@bethelsd.org')) return true;
  return leaders.some(row => districtEmail(row.email) === normalized && SIGNAL_ROLES.has(String(row.position || '').trim().toLowerCase().replace(/\s+/g, ' ')));
}
export async function signalsAccess(session, request = bridge) {
  if (!validToken(session)) return 401;
  const identity = await request({ action: 'auth-me', session }, 25000);
  if (identity.status !== 200) return identity.status === 401 ? 401 : 503;
  if (!districtEmail(identity.email)) return 403;
  if (leadershipAllowsSignals(identity.email, [])) return 200;
  const directory = await request({ action: 'auth-leadership-directory', session }, 25000);
  if (directory.status !== 200 || !Array.isArray(directory.leaders)) return directory.status === 401 ? 401 : 503;
  return leadershipAllowsSignals(identity.email, directory.leaders) ? 200 : 403;
}
