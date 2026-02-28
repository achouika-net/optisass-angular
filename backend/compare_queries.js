const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

async function compare() {
    try {
        const start = new Date(1970, 0, 1);
        const end = new Date(3000, 0, 1);

        // Approach 1: raw SQL (same as getProfitEvolution)
        const revenueQuery = Prisma.sql`
            SELECT "id", "numero", "type", "statut", "totalHT", "dateEmission", "centreId"
            FROM "Facture"
            WHERE "dateEmission" >= ${start} AND "dateEmission" <= ${end}
            AND (
                ( ("numero" LIKE 'FAC%' OR "type" = 'FACTURE' OR "type" = 'BON_COMMANDE') AND "statut" IN ('VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL') )
                OR "type" = 'AVOIR'
            )
        `;
        const rawResults = await prisma.$queryRaw(revenueQuery);
        console.log('RAW SQL results:', rawResults.length);
        rawResults.forEach(r => {
            const month = new Date(r.dateEmission).toISOString().substring(0, 7);
            console.log(`  [${month}] ${r.numero} | type=${r.type} | statut=${r.statut} | totalHT=${r.totalHT}`);
        });

        // Approach 2: Prisma findMany (same as getRealProfit)
        const ACTIVE_STATUSES = ['VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL'];
        const findManyResults = await prisma.facture.findMany({
            where: {
                dateEmission: { gte: start, lte: end },
                OR: [
                    {
                        OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }, { type: 'BON_COMMANDE' }],
                        statut: { in: ACTIVE_STATUSES }
                    },
                    { type: 'AVOIR' }
                ]
            },
            select: { id: true, numero: true, totalHT: true, type: true, dateEmission: true, centreId: true, statut: true }
        });

        console.log('\nPrisma findMany results:', findManyResults.length);
        findManyResults.forEach(r => {
            const month = new Date(r.dateEmission).toISOString().substring(0, 7);
            console.log(`  [${month}] ${r.numero} | type=${r.type} | statut=${r.statut} | totalHT=${r.totalHT}`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

compare();
