process.env.DATABASE_URL = "postgresql://postgres:admin@localhost:5432/optisass?schema=public";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function auditFactureData() {
    try {
        console.log('--- Auditing Facture Data ---');
        const factures = await prisma.facture.findMany({
            where: {
                OR: [
                    {
                        OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }, { type: 'BON_COMMANDE' }],
                        statut: { in: ['VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL'] }
                    },
                    { type: 'AVOIR' }
                ]
            },
            select: {
                dateEmission: true,
                totalHT: true,
                type: true,
                centreId: true,
                numero: true
            }
        });

        console.log(`Total active factures found: ${factures.length}`);

        const summary = {};
        let totalRevenue = 0;

        factures.forEach(f => {
            const month = f.dateEmission.toISOString().substring(0, 7);
            if (!summary[month]) summary[month] = { count: 0, revenue: 0 };

            summary[month].count++;
            const amount = f.type === 'AVOIR' ? -f.totalHT : f.totalHT;
            summary[month].revenue += amount;
            totalRevenue += amount;
        });

        console.log('Monthly Summary:');
        Object.keys(summary).sort().forEach(month => {
            console.log(`${month}: Count=${summary[month].count}, Revenue=${summary[month].revenue}`);
        });

        console.log(`Total Revenue calculated: ${totalRevenue}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

auditFactureData();
