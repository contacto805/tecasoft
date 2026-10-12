const bcrypt = require('bcryptjs');

// Hash the password
bcrypt.hash('2025Tecavo', 12, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
    process.exit(1);
  }
  console.log('Hashed password:');
  console.log(hash);
});
