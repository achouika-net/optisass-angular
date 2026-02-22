import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    // dateEmission is non-nullable in the current schema (DateTime @default(now()))
    // Querying for null will always return 0 and causes TypeScript errors.
    console.log('Checking for Factures with possible missing/null-equivalent dates...');

    const factures = await prisma.facture.findMany({
        where: {
            centreId,
            OR: [
                { type: 'FACTURE' },
                { numero: { startsWith: 'FAC' } }
            ]
        },
        select: {
            id: true,
            numero: true,
            dateEmission: true,
            totalTTC: true
        }
    });

    // In-memory check for null just in case of raw DB inconsistencies,
    // though Prisma schema enforces presence.
    const nullDateDocs = factures.filter(f => !f.dateEmission);

    console.log('Factures with technically missing dates:', nullDateDocs.length);
    const total = nullDateDocs.reduce((s, x) => s + (x.totalTTC || 0), 0);
    console.log('Total TTC of missing date factures:', total);

    const bcs = await prisma.facture.findMany({
        where: {
            centreId,
            OR: [
                { type: 'BON_COMMANDE' },
                { type: 'BON_COMM' },
                { numero: { startsWith: 'BC' } },
                { statut: 'VENTE_EN_INSTANCE' }
            ]
        },
        select: {
            id: true,
            numero: true,
            dateEmission: true,
            totalTTC: true
        }
    });

    const bcNullDate = bcs.filter(f => !f.dateEmission);

    console.log('BCs with technically missing dates:', bcNullDate.length);
    const totalBC = bcNullDate.reduce((s, x) => s + (x.totalTTC || 0), 0);
    console.log('Total TTC of missing date BCs:', totalBC);

    await prisma.$disconnect();
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
