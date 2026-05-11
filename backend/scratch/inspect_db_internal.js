require('dotenv').config();
const { db } = require('../db');

async function check() {
  try {
    const res = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products'
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Check failed:', err.message);
  }
  await db.close();
}

check();
