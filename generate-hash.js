const bcrypt = require('bcryptjs');

async function generate() {
  const password = '2025Tecavo';
  const hash = await bcrypt.hash(password, 12);
  console.log('Hash:', hash);
  console.log('Length:', hash.length);
}

generate().catch(console.error);
