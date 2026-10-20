// v40.0: sets the password of every staff account to the hospital default (1234)
// and clears "must change password". Patient records are not touched.
// A full backup of the database is written first.
// Usage (stop the EMR first):  npm run set-all-passwords
//                              node scripts/set-all-passwords.mjs --database <path>
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loadConfig } from '../server/config.mjs';
import { openDatabase } from '../server/database.mjs';
import { DEFAULT_STAFF_PASSWORD, hashPassword } from '../server/password.mjs';

function argumentsMap(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const item = values[index];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    if (index + 1 < values.length && !values[index + 1].startsWith('--')) {
      parsed[key] = values[index + 1];
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

async function emrIsRunning(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

function timestamp(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function main() {
  const args = argumentsMap(process.argv.slice(2));
  const config = loadConfig(args.database ? { databasePath: args.database, demoMode: false } : { demoMode: false });
  if (config.databasePath === ':memory:' || !fs.existsSync(config.databasePath)) {
    throw new Error(`Database not found: ${config.databasePath}`);
  }
  if (!args['skip-running-check'] && await emrIsRunning(config.port)) {
    throw new Error(`The EMR is still running on port ${config.port}. Stop it first (Ctrl+C in its window), then run this again.`);
  }

  const backupDirectory = path.join(path.dirname(config.databasePath), 'backups');
  fs.mkdirSync(backupDirectory, { recursive: true });
  const backupPath = path.join(backupDirectory, `${path.basename(config.databasePath, '.sqlite')}-before-1234-${timestamp()}.sqlite`);

  const database = openDatabase(config.databasePath);
  try {
    // A consistent single-file copy, including anything still in the WAL.
    database.sqlite.prepare('VACUUM INTO ?').run(backupPath);
    console.log(`Backup written: ${backupPath}`);

    const users = database.sqlite.prepare('SELECT id, username FROM users').all();
    const passwordHash = await hashPassword(DEFAULT_STAFF_PASSWORD);
    const now = Date.now();
    const update = database.sqlite.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?');
    const clearSessions = database.sqlite.prepare('DELETE FROM sessions WHERE user_id = ?');
    database.sqlite.exec('BEGIN');
    try {
      for (const user of users) {
        update.run(passwordHash, now, user.id);
        clearSessions.run(user.id);
        database.audit({
          id: crypto.randomUUID(),
          userId: user.id,
          subjectUsername: user.username,
          action: 'PASSWORD_SET_TO_HOSPITAL_DEFAULT',
          details: { mustChangePassword: false, script: 'set-all-passwords' },
          occurredAt: now,
        });
      }
      database.sqlite.exec('COMMIT');
    } catch (error) {
      database.sqlite.exec('ROLLBACK');
      throw error;
    }
    console.log(`Password set to the hospital default for ${users.length} account(s). Everyone must sign in again.`);
  } finally {
    database.close();
  }
}

main().catch(error => {
  console.error(`Could not set passwords: ${error.message}`);
  process.exitCode = 1;
});
