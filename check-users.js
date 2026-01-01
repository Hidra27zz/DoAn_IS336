// Check users in database
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./warehouse.db');

console.log('=== CHECKING USERS IN DATABASE ===\n');

db.all('SELECT id, username, password, role, email FROM users', [], (err, users) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }
  
  console.log(`Found ${users.length} users:\n`);
  users.forEach(user => {
    console.log(`Username: ${user.username}`);
    console.log(`Password: ${user.password}`);
    console.log(`Role: ${user.role}`);
    console.log(`Email: ${user.email}`);
    console.log('---');
  });
  
  db.close();
});
