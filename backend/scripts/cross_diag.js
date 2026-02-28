
const { PrismaClient } = require('@prisma/client');

async function check() {
    const urls = [
        { name: 'LOCAL (5432)', url: 'postgresql://postgres:admin@localhost:5432/optisaas?schema=public' },
        { name: 'DOCKER (5435)', url: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public' }
    ];

    for (const item of urls) {
        console.log(`Checking ${item.name}...`);
        const prisma = new PrismaClient({ datasources: { db: { url: item.url } } });
        try {
            const clients = await prisma.client.count();
            const factures = await prisma.factureFournisseur.count();
            console.log(`-> Clients: ${clients}, Invoices: ${factures}`);
        } catch (e) {
            console.log(`-> ERROR: ${e.message}`);
        } finally {
            await prisma.$disconnect();
        }
    }
}

check();
