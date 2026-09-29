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
  const deadline = Date.now() + 55000;
  async function read(action) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 1000) break;
      try {
        const result = await request({ action, session }, Math.min(25000, remaining));
        if (result.status !== 503) return result;
      } catch (_) { /* Retry a temporary school-service failure within the request deadline. */ }
    }
    console.warn('Signals access service unavailable', { action });
    return { status: 503 };
  }
  const identity = await read('auth-me');
  if (identity.status !== 200) return identity.status === 401 ? 401 : 503;
  if (!districtEmail(identity.email)) return 403;
  if (leadershipAllowsSignals(identity.email, [])) return 200;
  const directory = await read('auth-leadership-directory');
  if (directory.status !== 200 || !Array.isArray(directory.leaders)) return directory.status === 401 ? 401 : 503;
  return leadershipAllowsSignals(identity.email, directory.leaders) ? 200 : 403;
}
