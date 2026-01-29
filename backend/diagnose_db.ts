
import { PrismaClient } from '@prisma/client';

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
        console.log(fStatuts);

        console.log('\n--- Paiement Statuses ---');
        console.log(pStatuts);

        console.log('\n--- Depense Statuses ---');
        console.log(dStatuts);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
