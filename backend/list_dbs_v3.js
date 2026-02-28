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
        const res = await client.query(`
            SELECT datname, pg_size_pretty(pg_database_size(datname)) as size 
            FROM pg_database 
            WHERE datistemplate = false;
        `);
        console.log('Databases found:');
        console.table(res.rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

listDbs();
