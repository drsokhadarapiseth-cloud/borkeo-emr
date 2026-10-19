/**
 * Borkeo EMR - Structured Logger & Sensitive Data Redaction
 */

const SENSITIVE_KEYS = new Set([
  'password', 'passwordhash', 'password_hash', 'currentpassword', 'newpassword', 'confirmation',
  'token', 'csrftoken', 'csrf_token', 'tokenhash', 'token_hash', 'secret', 'totpcode', 'totp_code',
  'cookie', 'authorization', 'equitycard', 'equity_card', 'cardnumber', 'card_number', 'nationalid', 'national_id'
]);

export function redactSensitive(val, depth = 0) {
  if (depth > 6) return '[MAX_DEPTH]';
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    // Redact Bearer tokens, passwords in URLs
    return val
      .replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED]')
      .replace(/password=[^&]*/gi, 'password=[REDACTED]');
  }
  if (typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val.map(item => redactSensitive(item, depth + 1));
  }
  const clean = {};
  for (const [k, v] of Object.entries(val)) {
    const lowerKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (SENSITIVE_KEYS.has(lowerKey)) {
      clean[k] = '[REDACTED]';
    } else {
      clean[k] = redactSensitive(v, depth + 1);
    }
  }
  return clean;
}

const LOG_LEVELS = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

export class Logger {
  constructor(options = {}) {
    this.name = options.name || 'emr';
    this.level = (options.level || process.env.LOG_LEVEL || 'INFO').toUpperCase();
    this.format = options.format || (process.env.LOG_FORMAT === 'json' ? 'json' : 'text');
    this.bindings = options.bindings || {};
    this.output = options.output || console;
  }

  child(extraBindings = {}) {
    return new Logger({
      name: this.name,
      level: this.level,
      format: this.format,
      bindings: { ...this.bindings, ...extraBindings },
      output: this.output,
    });
  }

  isLevelEnabled(level) {
    const current = LOG_LEVELS[this.level] || LOG_LEVELS.INFO;
    const target = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    return target >= current;
  }

  log(level, message, meta = {}) {
    if (!this.isLevelEnabled(level)) return;

    let errObj = null;
    let cleanMeta = {};

    if (meta instanceof Error) {
      errObj = {
        name: meta.name,
        message: meta.message,
        stack: meta.stack,
      };
    } else if (meta && typeof meta === 'object') {
      if (meta.error instanceof Error) {
        errObj = {
          name: meta.error.name,
          message: meta.error.message,
          stack: meta.error.stack,
        };
        const { error, ...rest } = meta;
        cleanMeta = redactSensitive(rest);
      } else {
        cleanMeta = redactSensitive(meta);
      }
    } else if (meta !== undefined) {
      cleanMeta = { data: meta };
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      name: this.name,
      ...this.bindings,
      message,
      ...cleanMeta,
      ...(errObj ? { err: errObj } : {}),
    };

    if (this.format === 'json') {
      const line = JSON.stringify(entry);
      if (level === 'ERROR') {
        this.output.error(line);
      } else if (level === 'WARN') {
        this.output.warn(line);
      } else {
        this.output.log(line);
      }
    } else {
      const reqPart = entry.requestId ? ` [req:${entry.requestId.slice(0, 8)}]` : '';
      const compPart = entry.component ? ` [${entry.component}]` : '';
      const prefix = `${entry.timestamp} [${level}]${compPart}${reqPart}: ${message}`;

      const metaCopy = { ...cleanMeta };
      delete metaCopy.component;
      delete metaCopy.requestId;

      const hasMeta = Object.keys(metaCopy).length > 0;
      const metaStr = hasMeta ? ' ' + JSON.stringify(metaCopy) : '';
      const errStr = errObj ? `\n${errObj.stack || errObj.message}` : '';

      if (level === 'ERROR') {
        this.output.error(prefix + metaStr + errStr);
      } else if (level === 'WARN') {
        this.output.warn(prefix + metaStr + errStr);
      } else {
        this.output.log(prefix + metaStr + errStr);
      }
    }
  }

  debug(message, meta) { this.log('DEBUG', message, meta); }
  info(message, meta) { this.log('INFO', message, meta); }
  warn(message, meta) { this.log('WARN', message, meta); }
  error(message, meta) { this.log('ERROR', message, meta); }
}

export const defaultLogger = new Logger();
