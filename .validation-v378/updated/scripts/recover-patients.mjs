import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../server/config.mjs';
import { openDatabase } from '../server/database.mjs';
import { ensureAccessSchema } from '../server/access.mjs';
import { ensureDefaultWardUsers } from '../server/default-ward-users.mjs';
import { ensureParaclinicSchema } from '../server/paraclinic.mjs';
import { ensureFinanceSchema } from '../server/finance.mjs';
import { ensureDailyReportSchema } from '../server/daily-report.mjs';
import { ensureMessagingSchema } from '../server/messages.mjs';
import { ensureESignSchema } from '../server/esign.mjs';
import { preparePersistentDatabase, recoverLegacyPatientData, createDailyBackup } from '../server/persistent-data.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = loadConfig();
if (!config.autoDatabase) {
  console.error('DATABASE_PATH must be set to auto to use automatic recovery.');
  process.exit(1);
}
const prep = preparePersistentDatabase({ projectRoot, targetPath: config.databasePath });
const database = openDatabase(config.databasePath);
try {
  ensureAccessSchema(database); ensureDefaultWardUsers(database); ensureParaclinicSchema(database); ensureFinanceSchema(database);
  ensureDailyReportSchema(database); ensureMessagingSchema(database); ensureESignSchema(database);
  const result = recoverLegacyPatientData(database, { projectRoot, targetPath: config.databasePath, candidates: prep.candidates });
  createDailyBackup(database, config.databasePath);
  console.log(`Persistent database: ${config.databasePath}`);
  console.log(`Recovered/updated patient records: ${result.patients}`);
  console.log(`Recovered/updated clinical forms: ${result.forms}`);
  console.log(`Older databases contributing data: ${result.sources}`);
  console.log(`Total patients now available: ${database.listPatients().length}`);
} finally { database.close(); }
