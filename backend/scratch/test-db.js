const { Client } = require('pg');
const client = new Client({
  connectionString: "postgres://postgres:PoshakhAdmin2024%21@localhost:5432/poshakh"
});
client.connect()
  .then(() => {
    console.log('Connected successfully');
    return client.query('SELECT 1');
  })
  .then(res => {
    console.log('Query result:', res.rows);
    process.exit(0);
  })
  .catch(err => {
    console.error('Connection error:', err);
    process.exit(1);
  });
