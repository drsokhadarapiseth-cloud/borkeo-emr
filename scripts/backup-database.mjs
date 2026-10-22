import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../server/database.mjs';
import { createDatabaseBackup, checkDatabaseIntegrity } from '../server/backup.mjs';
import { loadConfig, projectRoot } from '../server/config.mjs';

const config = loadConfig();
const dbPath = process.argv[2] || config.databasePath;
const backupDir = process.argv[3] || config.backupDirectory || path.join(projectRoot, 'data', 'backups');

console.log(`Borkeo EMR Backup Utility`);
console.log(`Database source: ${dbPath}`);
console.log(`Backup target directory: ${backupDir}`);

const database = openDatabase(dbPath);
try {
  console.log('Running database integrity check...');
  const integrity = checkDatabaseIntegrity(database);
  if (!integrity.ok) {
    console.error('Database integrity check failed:');
    integrity.errors.forEach(e => console.error(` - ${e}`));
    process.exit(1);
  }
  console.log('Integrity check: OK');

  console.log('Executing online backup (VACUUM INTO)...');
  const result = createDatabaseBackup(database, {
    backupDirectory: backupDir,
    keepCount: 14,
  });

  console.log(`Backup completed successfully:`);
  console.log(` - File: ${result.filename}`);
  console.log(` - Path: ${result.filepath}`);
  console.log(` - Size: ${(result.sizeBytes / 1024).toFixed(1)} KB`);
  console.log(` - Duration: ${result.durationMs}ms`);
} catch (err) {
  console.error(`Backup failed: ${err.message}`);
  process.exit(1);
} finally {
  database.close();
}
