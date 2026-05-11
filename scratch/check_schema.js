const { initDb, db } = require('../backend/db');

async function checkSchema() {
  await initDb();
  const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all();
  tables.forEach(t => {
    console.log(`Table: ${t.name}`);
    console.log(t.sql);
    console.log('---');
  });
  process.exit(0);
}

checkSchema();
