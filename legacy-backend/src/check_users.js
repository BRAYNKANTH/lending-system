import db from './config/db.js';

async function main() {
  try {
    const users = await db('users').select('id', 'name', 'email', 'role', 'password_hash');
    console.log('USERS IN DB:');
    console.log(users);
  } catch (err) {
    console.error(err);
  } finally {
    await db.destroy();
  }
}
main();
