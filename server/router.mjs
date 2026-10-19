import { safeTokenEqual } from './password.mjs';
import { sessionRole } from './access.mjs';
import { assertValid, validate, v } from './validation.mjs';

function defaultSameOrigin(request, config) {
  if (!request.headers.origin) return true;
  if (request.headers.origin === config?.appOrigin) return true;
  try {
    const originHost = new URL(request.headers.origin).host;
    const reqHost = request.headers.host;
    if (originHost && reqHost && originHost.toLowerCase() === reqHost.toLowerCase()) return true;
  } catch {}
  return false;
}

export class Router {
  constructor(name = 'default') {
    this.name = name;
    this.routes = [];
  }

  add(method, pattern, handler, options = {}) {
    this.routes.push({
      method: method.toUpperCase(),
      pattern,
      handler,
      options,
    });
    return this;
  }

  get(pattern, handler, options) { return this.add('GET', pattern, handler, options); }
  post(pattern, handler, options) { return this.add('POST', pattern, handler, options); }
  put(pattern, handler, options) { return this.add('PUT', pattern, handler, options); }
  patch(pattern, handler, options) { return this.add('PATCH', pattern, handler, options); }
  delete(pattern, handler, options) { return this.add('DELETE', pattern, handler, options); }

  mount(subRouter) {
    if (subRouter && Array.isArray(subRouter.routes)) {
      this.routes.push(...subRouter.routes);
    }
    return this;
  }

  async handle(ctx) {
    const { request, response, pathname, config, session, sendJson, readJson } = ctx;
    const method = request.method ? request.method.toUpperCase() : 'GET';
    const checkSameOrigin = ctx.sameOrigin || defaultSameOrigin;
    const checkSafeToken = ctx.safeTokenEqual || safeTokenEqual;
    const getRole = ctx.sessionRole || sessionRole;

    for (const route of this.routes) {
      if (route.method !== method) continue;

      let match = null;
      if (typeof route.pattern === 'string') {
        if (route.pattern === pathname) {
          match = [pathname];
        }
      } else if (route.pattern instanceof RegExp) {
        match = route.pattern.exec(pathname);
      } else if (typeof route.pattern === 'function') {
        match = route.pattern(pathname, ctx);
      }

      if (!match) continue;

      // 1. Central CSRF enforcement for all state-changing methods (POST, PUT, PATCH, DELETE)
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        if (!route.options.skipCsrf) {
          if (!checkSameOrigin(request, config) || !checkSafeToken(request.headers['x-csrf-token'], session?.csrf_token)) {
            sendJson(response, 403, { error: 'Security token is invalid.' }, { secure: config.cookieSecure });
            return true;
          }
        }
      }

      // 2. requireSession middleware
      if (route.options.requireSession && !session) {
        sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
        return true;
      }

      // 3. requireRole middleware
      if (route.options.roles && session) {
        const role = getRole(session);
        const allowed = Array.isArray(route.options.roles) ? route.options.roles : [route.options.roles];
        if (!allowed.includes(role)) {
          sendJson(response, 403, { error: route.options.roleError || 'Access denied.' }, { secure: config.cookieSecure });
          return true;
        }
      }

      // 4. Optional body parsing if requested via options
      let body = null;
      if (route.options.parseJson && ['POST', 'PUT', 'PATCH'].includes(method) && readJson) {
        try {
          body = await readJson(request, route.options.maxBodyBytes || config.maxBodyBytes);
          if (route.options.schema) {
            body = assertValid(body, route.options.schema);
          }
        } catch (err) {
          sendJson(response, err.status || 400, { error: err.message, details: err.details }, { secure: config.cookieSecure });
          return true;
        }
      }

      const routeCtx = { ...ctx, match, routeParams: match, body, assertValid, validate, v };
      try {
        const res = await route.handler(routeCtx);
        if (res !== false) {
          return true;
        }
      } catch (err) {
        if (!response.writableEnded) {
          sendJson(response, err.status || 500, { error: err.message || 'Internal server error', details: err.details }, { secure: config.cookieSecure });
        }
        return true;
      }
    }

    return false;
  }
}
