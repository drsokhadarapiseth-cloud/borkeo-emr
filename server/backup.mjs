import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { defaultLogger } from './logger.mjs';

/**
 * Checks integrity of the database including pages, indexes and foreign key references.
 */
export function checkDatabaseIntegrity(sqliteOrDatabase) {
  const sqlite = sqliteOrDatabase.sqlite || sqliteOrDatabase;
  const errors = [];

  try {
    const rows = sqlite.prepare('PRAGMA integrity_check').all();
    for (const row of rows) {
      const val = row.integrity_check || Object.values(row)[0];
      if (val !== 'ok') {
        errors.push(`Integrity error: ${val}`);
      }
    }
  } catch (err) {
    errors.push(`Integrity check failed to execute: ${err.message}`);
  }

  try {
    const fkRows = sqlite.prepare('PRAGMA foreign_key_check').all();
    for (const fk of fkRows) {
      errors.push(`Foreign key violation in table ${fk.table || fk.from || 'unknown'}`);
    }
  } catch (err) {
    errors.push(`Foreign key check failed to execute: ${err.message}`);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

/**
 * Creates an online consistent backup of the database using SQLite's VACUUM INTO.
 */
export function createDatabaseBackup(database, options = {}) {
  const startTime = Date.now();
  const sqlite = database.sqlite || database;
  const now = new Date();
  const timestampStr = now.toISOString().replace(/[:.]/g, '-');

  const defaultDir = path.resolve(process.cwd(), 'data', 'backups');
  const backupDir = options.backupDirectory || defaultDir;
  fs.mkdirSync(backupDir, { recursive: true });

  const filename = options.filename || `borkeo-emr-backup-${timestampStr}.sqlite`;
  const targetPath = path.join(backupDir, filename);

  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }

  // SQLite SQL literal needs forward slashes on Windows
  const sqlitePath = targetPath.replace(/\\/g, '/');
  sqlite.exec(`VACUUM INTO '${sqlitePath}'`);

  const stat = fs.statSync(targetPath);

  // Validate the created backup file with integrity_check
  const backupDb = new DatabaseSync(targetPath);
  try {
    const integrity = checkDatabaseIntegrity(backupDb);
    if (!integrity.ok) {
      throw new Error(`Created backup failed integrity check: ${integrity.errors.join('; ')}`);
    }
  } finally {
    backupDb.close();
  }

  const durationMs = Date.now() - startTime;
  defaultLogger.info('Database backup created successfully', {
    filename,
    sizeBytes: stat.size,
    durationMs,
  });

  if (options.keepCount && options.keepCount > 0) {
    pruneBackups(backupDir, options.keepCount);
  }

  return {
    ok: true,
    filepath: targetPath,
    filename,
    sizeBytes: stat.size,
    durationMs,
    createdAt: now.toISOString(),
  };
}

/**
 * Prunes older backups in the directory, keeping the most recent keepCount files.
 */
export function pruneBackups(backupDir, keepCount = 10) {
  if (!fs.existsSync(backupDir)) return 0;
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('borkeo-emr-backup-') && f.endsWith('.sqlite'))
    .map(f => {
      const fullPath = path.join(backupDir, f);
      return {
        filename: f,
        filepath: fullPath,
        mtime: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtime - a.mtime);

  let prunedCount = 0;
  if (files.length > keepCount) {
    const toDelete = files.slice(keepCount);
    for (const file of toDelete) {
      try {
        fs.unlinkSync(file.filepath);
        prunedCount++;
      } catch (err) {
        defaultLogger.warn(`Failed to prune old backup ${file.filename}`, { error: err.message });
      }
    }
  }
  return prunedCount;
}

/**
 * Starts periodic backup scheduler.
 */
export function startBackupScheduler(database, config = {}, options = {}) {
  const intervalMs = options.intervalMs || 6 * 60 * 60 * 1000; // default 6 hours
  const keepCount = options.keepCount || 14; // default keep 14 snapshots

  const timer = setInterval(() => {
    try {
      createDatabaseBackup(database, {
        backupDirectory: options.backupDirectory,
        keepCount,
      });
    } catch (err) {
      defaultLogger.error('Scheduled database backup failed', { error: err });
    }
  }, intervalMs);

  timer.unref();
  return {
    stop() {
      clearInterval(timer);
    },
  };
}
