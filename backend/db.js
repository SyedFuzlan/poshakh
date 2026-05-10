// ────────────────────────────────────────────────────────────────────────
//  db.js  — PostgreSQL wrapper with pg-pool
// ────────────────────────────────────────────────────────────────────────
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/poshakh'
});

function flatParams(args) {
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}

// Re-export an async prepare API to minimize route breakage
function prepare(sql) {
  return {
    async all(...args) {
      const params = flatParams(args);
      const res = await pool.query(sql, params);
      return res.rows;
    },
    async get(...args) {
      const params = flatParams(args);
      const res = await pool.query(sql, params);
      return res.rows[0] || null;
    },
    async run(...args) {
      const params = flatParams(args);
      const res = await pool.query(sql, params);
      const lastInsertRowid = (res.rows && res.rows[0] && res.rows[0].id) ? res.rows[0].id : 0;
      return { lastInsertRowid };
    }
  };
}

async function query(text, params) {
  return pool.query(text, params);
}

async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // passing client so the caller can use client.query inside transaction
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function logAudit({ adminId, action, details, oldValue, newValue }) {
  try {
    await pool.query(`
      INSERT INTO audit_logs (admin_id, action, details, old_value, new_value)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      adminId || 'system',
      action,
      details || null,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null
    ]);
  } catch (err) {
    console.error('[db] Audit log failed:', err.message);
  }
}

async function initDb() {
  console.log('[db] PostgreSQL init');
  return pool;
}

function saveDb() {
  // no-op for postgres
}

function getDb() {
  return pool;
}

module.exports = {
  initDb,
  saveDb,
  getDb,
  db: { prepare, transaction, logAudit, query, pool },
};
