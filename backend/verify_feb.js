const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const start = new Date('2026-01-31T23:00:00.000Z');
    const end = new Date('2026-02-01T22:59:59.999Z');
    const tenantId = '9ed857f4-dc03-449f-8fb8-42f7258bc113';

    console.log(`Checking Feb Filter: ${start.toISOString()} to ${end.toISOString()}`);

    const depenses = await prisma.depense.findMany({
        where: {
            date: { gte: start, lte: end },
            centreId: tenantId
        }
    });

    console.log(`Found ${depenses.length} depenses.`);
    depenses.forEach(d => {
        console.log(`ID: ${d.id}, Date: ${d.date.toISOString()}, Amount: ${d.montant}`);
    });

    const factures = await prisma.facture.findMany({
        where: {
            dateEmission: { gte: start, lte: end },
            statut: { in: ['VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL'] },
            type: { not: 'AVOIR' },
            centreId: tenantId
        }
    });

    console.log(`Found ${factures.length} factures.`);
    let totalRevenue = 0;
    factures.forEach(f => {
        console.log(`Date: ${f.dateEmission.toISOString()}, TotalHT: ${f.totalHT}`);
        totalRevenue += f.totalHT;
    });
    console.log(`Total Revenue: ${totalRevenue}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
