import { loadConfig } from '../server/config.mjs';
import { openDatabase } from '../server/database.mjs';
import { ensureAccessSchema } from '../server/access.mjs';
import { DEFAULT_WARD_PASSWORD, defaultWardAccountPlan, ensureDefaultWardUsers } from '../server/default-ward-users.mjs';

const config = loadConfig();
const database = openDatabase(config.databasePath);
try {
  ensureAccessSchema(database);
  const result = ensureDefaultWardUsers(database);
  console.log(`Ward staff accounts ready. Created ${result.created.length} missing account(s).`);
  console.log(`Default password: ${DEFAULT_WARD_PASSWORD}`);
  for (const account of defaultWardAccountPlan()) {
    console.log(`${account.username} | ${account.role} | ${account.wardCode}`);
  }
} finally {
  database.close();
}
