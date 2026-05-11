const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://postgres:PoshakhAdmin2024%21@localhost:5432/poshakh'
});

async function check() {
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'products'
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}

check();
