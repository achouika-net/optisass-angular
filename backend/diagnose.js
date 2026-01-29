
const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();
    try {
        const factures = await prisma.facture.count();
        const paiements = await prisma.paiement.count();
        const depenses = await prisma.depense.count();

        const fStatuts = await prisma.facture.groupBy({ by: ['statut'], _count: true });
        const pStatuts = await prisma.paiement.groupBy({ by: ['statut'], _count: true });
        const dStatuts = await prisma.depense.groupBy({ by: ['statut'], _count: true });

        console.log('--- Counts ---');
        console.log('Factures:', factures);
        console.log('Paiements:', paiements);
        console.log('Depenses:', depenses);

        console.log('\n--- Facture Statuses ---');
        console.log(JSON.stringify(fStatuts, null, 2));

        console.log('\n--- Paiement Statuses ---');
        console.log(JSON.stringify(pStatuts, null, 2));

        console.log('\n--- Depense Statuses ---');
        console.log(JSON.stringify(dStatuts, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
