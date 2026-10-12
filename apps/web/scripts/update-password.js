const bcrypt = require('bcryptjs');
const { neon } = require('@neondatabase/serverless');

async function updatePassword() {
  const sql = neon(process.env.DATABASE_URL);
  
  // Hash the password
  const password = '2025Tecavo';
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);
  
  console.log('Hashed password:', hashedPassword);
  
  // Update the password in the account table
  const result = await sql`
    UPDATE account 
    SET password = ${hashedPassword}
    WHERE "userId" = (SELECT id FROM "user" WHERE email = 'contacto@tecavofruits.com')
    RETURNING "userId", "providerId"
  `;
  
  console.log('Update result:', result);
  
  if (result.length > 0) {
    console.log('✅ Password updated successfully for user:', result[0].userId);
    
    // Verify the update
    const verify = await sql`
      SELECT a."userId", a."providerId", u.email, u.name
      FROM account a
      JOIN "user" u ON a."userId" = u.id
      WHERE u.email = 'contacto@tecavofruits.com' AND a.password IS NOT NULL
    `;
    
    console.log('Verification:', verify);
  } else {
    console.log('❌ No account found to update');
  }
}

updatePassword().catch(console.error);
