export const TTL = 10 * 60 * 1000;
export function emrOrigin(raw) {
  const url = new URL(raw);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error('ORIGIN_REQUIRED');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) throw Error('HTTPS_REQUIRED');
  if (url.hostname === 'pmrs.digitalsp.gov.kh') throw Error('EMR_ORIGIN_REQUIRED');
  return url.origin;
}
// Chrome host permissions span ports. Delivery still checks the configured
// origin INCLUDING its port before every injection and fetch.
export function permissionPattern(origin) { const url=new URL(origin); return url.protocol+'//'+url.hostname+'/*'; }
// Runs in the trusted EMR page, so requests use its normal first-party session.
// No cookies, CSRF tokens or credentials are returned to the extension.
export async function inspectEmr(expectedOrigin) {
  if (location.origin !== expectedOrigin) return { code: 'WRONG_ORIGIN' };
  try {
    const response = await fetch('/api/auth/me', {credentials:'same-origin', cache:'no-store'});
    if (response.status === 401) return {code:'LOGIN_REQUIRED'};
    if (!response.ok) return {code:'SERVER_UNAVAILABLE'};
    const session = await response.json();
    if (session.demoMode) return {code:'DEMO_DISABLED'};
    const user = session.user;
    if (user?.mustChangePassword) return {code:'LOGIN_REQUIRED'};
    if (!user?.activeRole) return {code:'CONTEXT_REQUIRED'};
    if (!['ADMIN','VICE_DIRECTOR','REGISTRATION'].includes(user.activeRole) && !(user.activeRole === 'DOCTOR' && user.activeWard?.code === 'opd')) return {code:'REGISTRATION_ROLE_REQUIRED'};
    return {code:'READY'};
  } catch { return {code:'SERVER_UNAVAILABLE'}; }
}
export async function deliverPatient(expectedOrigin, nonce, registration) {
  if (location.origin !== expectedOrigin || location.pathname !== '/emr' || new URL(location.href).searchParams.get('pmrsExtension') !== nonce) return {code:'WRONG_TARGET'};
  if (typeof window.receivePmrsExtensionRegistration !== 'function') return {code:'RECEIVER_UPDATE_REQUIRED'};
  return window.receivePmrsExtensionRegistration(nonce, registration);
}
