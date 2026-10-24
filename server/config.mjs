import fs from 'node:fs';
import { npcaSettings } from './npca/settings.mjs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(serverDirectory, '..');

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const name = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

function positiveInteger(value, fallback, name) {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

// v42.4: patient uploads (scanned documents, message, payment and paraclinic
// attachments). With DATA_DIR: DATA_DIR/uploads. Without it: next to the
// database, exactly as before.
export function uploadDirectory(config, ...parts) {
  const base = config.dataDirectory
    ? path.join(config.dataDirectory, 'uploads')
    : path.join(path.dirname(config.databasePath), 'uploads');
  return path.join(base, ...parts);
}

export function loadConfig(overrides = {}) {
  loadDotEnv(path.join(projectRoot, '.env'));
  const emrMode = String(overrides.emrMode ?? process.env.EMR_MODE ?? '').toLowerCase();
  const nodeEnv = overrides.nodeEnv ?? process.env.NODE_ENV ?? (emrMode === 'production' ? 'production' : 'development');
  const isProduction = emrMode === 'production' || nodeEnv === 'production';

  // Demo mode is opt-in in production (EMR_MODE=demo). For backward-compatibility in tests,
  // in-memory databases default to demo mode unless demoMode is explicitly false or in production.
  const demoMode = overrides.demoMode !== undefined
    ? Boolean(overrides.demoMode)
    : (isProduction ? false : (emrMode === 'demo' || overrides.databasePath === ':memory:'));

  const port = overrides.port ?? positiveInteger(process.env.PORT, 3001, 'PORT');
  const host = overrides.host ?? (demoMode ? '127.0.0.1' : process.env.HOST || '127.0.0.1');
  const appOrigin = overrides.appOrigin ?? (demoMode ? `http://localhost:${port}` : process.env.APP_ORIGIN ?? `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  const originUrl = new URL(appOrigin);
  if (!['http:', 'https:'].includes(originUrl.protocol) || originUrl.pathname !== '/') {
    throw new Error('APP_ORIGIN must contain only an http(s) origin, without a path.');
  }
  if (demoMode && (!['127.0.0.1', '::1', 'localhost', '0.0.0.0', ''].includes(host) ||
      !['127.0.0.1', '[::1]', 'localhost', '0.0.0.0'].includes(originUrl.hostname))) {
    throw new Error('Username-only demo must run on this computer (localhost) or local network.');
  }

  const demoDatabasePath = path.join(projectRoot, 'data', 'demo.sqlite');
  if (demoMode && overrides.databasePath &&
      overrides.databasePath !== ':memory:' && path.resolve(overrides.databasePath) !== demoDatabasePath) {
    throw new Error('Username-only demo cannot use the patient database.');
  }
  // v42.4: DATA_DIR (online host volume, for example /data) holds everything that
  // must survive a restart: the database, patient uploads and backups. Without it
  // the hospital computer keeps today's locations. The local demo ignores it.
  const dataDirectorySetting = demoMode ? '' : String(overrides.dataDirectory ?? process.env.DATA_DIR ?? '').trim();
  const dataDirectory = dataDirectorySetting ? path.resolve(projectRoot, dataDirectorySetting) : '';
  const databaseSetting = demoMode
    ? (overrides.databasePath ?? demoDatabasePath)
    : (overrides.databasePath ?? (process.env.DATABASE_PATH || undefined) ?? (dataDirectory ? path.join(dataDirectory, 'emr.sqlite') : 'auto'));
  const autoDatabase = String(databaseSetting).trim().toLowerCase() === 'auto';
  const databasePath = databaseSetting === ':memory:'
    ? databaseSetting
    : autoDatabase
      ? path.join(os.homedir(), 'Borkeo_EMR_Data', 'emr.sqlite')
      : path.resolve(projectRoot, databaseSetting);
  const cookieSecure = overrides.cookieSecure ?? (isProduction ? true : (demoMode ? false : process.env.COOKIE_SECURE === 'true'));
  if (demoMode && isProduction) {
    throw new Error('The username-only demo is for local testing, not production.');
  }
  if (isProduction && !cookieSecure) {
    throw new Error('COOKIE_SECURE must be true in production.');
  }

  // v42.4: behind a hosting proxy (Railway, Render, Fly.io) the client address
  // is read from X-Forwarded-For only when TRUST_PROXY=true.
  const trustProxy = overrides.trustProxy ?? process.env.TRUST_PROXY === 'true';

  const config = {
    projectRoot,
    npca: npcaSettings(overrides.npca),
    demoMode,
    isProduction,
    trustProxy,
    dataDirectory,
    // Empty when DATA_DIR is not set: each backup keeps its usual folder.
    backupDirectory: dataDirectory ? path.join(dataDirectory, 'backups') : '',
    host,
    port,
    appOrigin: originUrl.origin,
    nodeEnv: overrides.nodeEnv ?? process.env.NODE_ENV ?? 'development',
    databasePath,
    autoDatabase,
    cookieSecure,
    sessionTtlMs: positiveInteger(
      overrides.sessionTtlMinutes ?? process.env.SESSION_TTL_MINUTES,
      480,
      'SESSION_TTL_MINUTES',
    ) * 60_000,
    loginMaxAttempts: positiveInteger(
      overrides.loginMaxAttempts ?? process.env.LOGIN_MAX_ATTEMPTS,
      5,
      'LOGIN_MAX_ATTEMPTS',
    ),
    loginWindowMs: positiveInteger(
      overrides.loginWindowMinutes ?? process.env.LOGIN_WINDOW_MINUTES,
      15,
      'LOGIN_WINDOW_MINUTES',
    ) * 60_000,
    maxBodyBytes: 16 * 1024,
    maxClinicalBodyBytes: 128 * 1024,
    maxPatientBodyBytes: 2 * 1024 * 1024,
    maxHospitalStateBytes: 768 * 1024,
    publicDirectory: path.join(projectRoot, 'public'),
    protectedDirectory: path.join(projectRoot, 'protected'),
  };
  // v42.4: the production Superuser password (SUPERUSER_PASSWORD). Not enumerable,
  // so it never appears when the configuration is printed or logged.
  Object.defineProperty(config, 'superuserPassword', {
    value: String(overrides.superuserPassword ?? process.env.SUPERUSER_PASSWORD ?? ''),
    enumerable: false,
  });
  return config;
}
