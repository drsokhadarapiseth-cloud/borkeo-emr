import crypto from 'node:crypto';
import process from 'node:process';
import { loadConfig } from '../server/config.mjs';
import { openDatabase } from '../server/database.mjs';
import { hashPassword, validatePassword, validateUsername } from '../server/password.mjs';

function argumentsMap(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const item = values[index];
    if (!item.startsWith('--')) continue;
    parsed[item.slice(2)] = values[index + 1];
    index += 1;
  }
  return parsed;
}

function hiddenInput(prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Password reset must be run in an interactive terminal.');
  }
  return new Promise((resolve, reject) => {
    let value = '';
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
    };
    const onData = chunk => {
      for (const character of chunk) {
        if (character === '\u0003') {
          cleanup();
          process.stdout.write('\n');
          reject(new Error('Cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          if (value) {
            value = Array.from(value).slice(0, -1).join('');
            process.stdout.write('\b \b');
          }
          continue;
        }
        if (character >= ' ') {
          value += character;
          process.stdout.write('*');
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

async function main() {
  const args = argumentsMap(process.argv.slice(2));
  const username = validateUsername(args.username ?? 'admin');
  const password = await hiddenInput(`New password for ${username} (12–128 characters): `);
  validatePassword(password);
  const confirmation = await hiddenInput('Confirm password: ');
  if (password !== confirmation) throw new Error('Passwords do not match.');

  const config = loadConfig();
  const database = openDatabase(config.databasePath);
  try {
    const user = database.findUser(username);
    if (!user) throw new Error(`User "${username}" does not exist.`);
    const now = Date.now();
    const passwordHash = await hashPassword(password);
    database.sqlite.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`)
      .run(passwordHash, now, user.id);
    database.sqlite.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    database.audit({
      id: crypto.randomUUID(),
      userId: user.id,
      subjectUsername: user.username,
      action: 'PASSWORD_RESET_FROM_LOCAL_CONSOLE',
      occurredAt: now,
    });
    console.log(`Password changed successfully for ${username}.`);
  } finally {
    database.close();
  }
}

main().catch(error => {
  console.error(`Could not reset password: ${error.message}`);
  process.exitCode = 1;
});
