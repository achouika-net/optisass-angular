const { Client } = require('pg');

async function testConnection(port, user, password, database) {
  const client = new Client({
    host: '127.0.0.1',
    port: port,
    user: user,
    password: password,
    database: database,
  });

  try {
    await client.connect();
    console.log(`✅ SUCCESS: port=${port}, user=${user}, password=${password}, database=${database}`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`❌ FAIL: port=${port}, user=${user}, password=${password}, database=${database} - ${err.message}`);
    return false;
  }
}

async function run() {
  const ports = [5432, 5435];
  const passwords = ['mypassword', 'admin', 'postgres'];
  const dbs = ['optisaas', 'optisass', 'postgres'];

  for (const port of ports) {
    for (const password of passwords) {
      for (const db of dbs) {
        await testConnection(port, 'postgres', password, db);
      }
    }
  }
}

run();
