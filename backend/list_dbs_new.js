const { Client } = require('pg');

async function listDbs() {
    const client = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'postgres',
        password: 'admin',
        port: 5432,
    });

    try {
        await client.connect();
        const res = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
        console.log('Databases found:');
        console.log(res.rows.map(r => r.datname));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

listDbs();
