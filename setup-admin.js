const bcrypt = require('bcryptjs');

async function setupAdmin() {
  const password = "2025Tecavo";
  const hashed = await bcrypt.hash(password, 12);
  console.log(hashed);
}

setupAdmin();
