const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DB_PATH = path.join(__dirname, '..', 'data', 'poshakh.db');
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(BACKUP_DIR, `poshakh_backup_${timestamp}.db`);

console.log(`[backup] Starting backup of ${DB_PATH}...`);

try {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[backup] Error: Database file not found at ${DB_PATH}`);
    process.exit(1);
  }

  // Copy the file
  fs.copyFileSync(DB_PATH, backupPath);
  
  console.log(`[backup] Backup created successfully: ${backupPath}`);

  // Keep only the last 7 backups to save space
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('poshakh_backup_'))
    .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);

  if (files.length > 7) {
    console.log(`[backup] Cleaning up old backups...`);
    files.slice(7).forEach(f => {
      fs.unlinkSync(path.join(BACKUP_DIR, f.name));
      console.log(`[backup] Deleted: ${f.name}`);
    });
  }

} catch (err) {
  console.error('[backup] Backup failed:', err.message);
  process.exit(1);
}
