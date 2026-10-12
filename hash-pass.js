const bcrypt = require('bcryptjs');

async function generate() {
  const hash = await bcrypt.hash('2025Tecavo', 12);
  console.log(hash);
}

generate();
