import crypto from 'node:crypto';
import process from 'node:process';
import { loadConfig } from '../server/config.mjs';
import { openDatabase, USER_ROLES } from '../server/database.mjs';
import { ensureAccessSchema, setUserAccess } from '../server/access.mjs';
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
    throw new Error('User creation must be run in an interactive terminal.');
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
  const username = validateUsername(args.username);
  const displayName = String(args['display-name'] ?? '').trim();
  const role = String(args.role ?? '').toUpperCase();
  if (!displayName || displayName.length > 100) {
    throw new Error('--display-name is required and must be at most 100 characters.');
  }
  if (!USER_ROLES.includes(role)) {
    throw new Error(`--role must be one of: ${USER_ROLES.join(', ')}`);
  }

  const password = await hiddenInput('New password (12–128 characters): ');
  validatePassword(password);
  const confirmation = await hiddenInput('Confirm password: ');
  if (password !== confirmation) throw new Error('Passwords do not match.');

  const config = loadConfig();
  const database = openDatabase(config.databasePath);
  ensureAccessSchema(database);
  try {
    if (database.findUser(username)) throw new Error('That username already exists.');
    const now = Date.now();
    database.createUser({
      id: crypto.randomUUID(),
      username,
      displayName,
      role,
      passwordHash: await hashPassword(password),
      createdAt: now,
    });
    if (['ADMIN','LAB','IMAGING','PHARMACY','ACCOUNTANT','CLERK','DIRECTOR'].includes(role)) {
      setUserAccess(database, database.findUser(username).id, [role], [], now);
    }
    database.audit({
      id: crypto.randomUUID(),
      subjectUsername: username,
      action: 'USER_CREATED_FROM_LOCAL_CONSOLE',
      details: { role },
      occurredAt: now,
    });
  } finally {
    database.close();
  }
  console.log(`Created ${username} with role ${role}.`);
}

main().catch(error => {
  console.error(`Could not create user: ${error.message}`);
  process.exitCode = 1;
});
