export const SESSION_COOKIE = 'emr_session';

export function applySecurityHeaders(response, { legacy = false, secure = false, review = false, camera = false } = {}) {
  const policy = legacy
    ? [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'self'",
        "form-action 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.tailwindcss.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
        "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "frame-src 'self' data: blob:",
      ].join('; ')
    : [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        review ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
        "form-action 'self'",
        "script-src 'self'",
        review ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
        "font-src 'self'",
        "img-src 'self' data:",
        "connect-src 'self'",
      ].join('; ');
  response.setHeader('Content-Security-Policy', policy+(camera?"; media-src 'self' blob:":''));
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', legacy ? 'SAMEORIGIN' : 'DENY');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Permissions-Policy', (camera?'camera=(self)':'camera=()')+', microphone=(), geolocation=(), payment=(), usb=()');
  if (secure) response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

export function serializeSessionCookie(token, maxAgeSeconds, secure) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

export function clearSessionCookie(secure) {
  return [
    `${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict',
    'Max-Age=0', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT', secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

export function parseCookies(header) {
  const cookies = {};
  for (const part of String(header ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try { cookies[name] = decodeURIComponent(value); } catch { /* Ignore malformed cookie. */ }
  }
  return cookies;
}
