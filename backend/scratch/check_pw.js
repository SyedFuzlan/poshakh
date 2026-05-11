const bcrypt = require('bcryptjs');
const hash = '$2a$12$6udEEMUKld6OZvO43v7Xq.5l1yGEBifDenoa0nbQlMtW/nSN4XIu2';
const passwords = ['PoshakhAdmin2024!', 'admin123', 'ChangeMe123!'];

async function check() {
  for (const pw of passwords) {
    const match = await bcrypt.compare(pw, hash);
    console.log(`${pw}: ${match}`);
  }
}

check();
