const bcrypt = require('bcryptjs');
const password = 'PoshakhAdmin2024!';

async function run() {
  const hash = await bcrypt.hash(password, 12);
  console.log('Password:', password);
  console.log('New Hash:', hash);
}

run();
