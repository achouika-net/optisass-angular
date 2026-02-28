import { Client } from 'pg';

async function main() {
    const commonConfig = {
        user: 'postgres',
        host: 'localhost',
        password: 'admin',
        port: 5432,
    };

    const client = new Client({ ...commonConfig, database: 'postgres' });
    await client.connect();

    try {
        const res = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false');
        const dbNames = res.rows.map(r => r.datname);
        console.log('Databases found:', dbNames);

        for (const dbName of dbNames) {
            const dbClient = new Client({ ...commonConfig, database: dbName });
            try {
                await dbClient.connect();
                const tableCheck = await dbClient.query("SELECT count(*) FROM information_schema.tables WHERE table_name = 'Facture'");
                if (parseInt(tableCheck.rows[0].count) > 0) {
                    const rowCount = await dbClient.query('SELECT count(*) FROM "Facture"');
                    console.log(`DATABASE: ${dbName} | Facture rows: ${rowCount.rows[0].count}`);
                    if (parseInt(rowCount.rows[0].count) > 0) {
                        const ttcResult = await dbClient.query('SELECT sum("totalTTC") FROM "Facture"');
                        console.log(`DATABASE: ${dbName} | Total TTC: ${ttcResult.rows[0].sum}`);
                    }
                } else {
                    console.log(`DATABASE: ${dbName} | Facture table not found.`);
                }
            } catch (e) {
                console.log(`DATABASE: ${dbName} | Could not connect or query: ${e.message}`);
            } finally {
                await dbClient.end();
            }
        }
    } finally {
        await client.end();
    }
}

main().catch(console.error);
