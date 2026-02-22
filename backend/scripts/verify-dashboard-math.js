const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';
    const start = new Date('2000-01-01T00:00:00.000Z');
    const end = new Date('2026-02-21T23:59:59.999Z');

    const dateFilter = { dateEmission: { gte: start, lte: end } };
    const paymentDateFilter = { date: { gte: start, lte: end } };

    // 1. Facture CA
    const factures = await prisma.facture.aggregate({
        _sum: { totalTTC: true },
        where: {
            centreId,
            OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }],
            statut: { notIn: ['VENTE_EN_INSTANCE', 'ANNULEE', 'ARCHIVE'] },
            type: { not: 'AVOIR' },
            ...dateFilter
        }
    });

    // 2. BC CA
    const bcs = await prisma.facture.aggregate({
        _sum: { totalTTC: true },
        where: {
            centreId,
            OR: [
                { type: 'BON_COMMANDE' },
                { type: 'BON_COMM' },
                { numero: { startsWith: 'BC' } },
                { statut: 'VENTE_EN_INSTANCE' }
            ],
            statut: { notIn: ['ANNULEE', 'ARCHIVE'] },
            ...dateFilter
        }
    });

    // 3. Payments
    const payments = await prisma.paiement.aggregate({
        _sum: { montant: true },
        where: {
            ...paymentDateFilter,
            facture: { centreId }
        }
    });

    // 4. Reste
    const reste = await prisma.facture.aggregate({
        _sum: { resteAPayer: true },
        where: {
            centreId,
            statut: { not: 'ANNULEE' }
            // Dashboard currently lacks dateFilter here!
        }
    });

    console.log('--- Dashboard Math Verification ---');
    console.log('Factures CA:', factures._sum.totalTTC || 0);
    console.log('BC CA:', bcs._sum.totalTTC || 0);
    console.log('Total CA (Manual Sum):', (factures._sum.totalTTC || 0) + (bcs._sum.totalTTC || 0));
    console.log('Total Paid (in period):', payments._sum.montant || 0);
    console.log('Delta (CA - Paid):', ((factures._sum.totalTTC || 0) + (bcs._sum.totalTTC || 0)) - (payments._sum.montant || 0));
    console.log('Total Reste (Stored Sum):', reste._sum.resteAPayer || 0);

    await prisma.$disconnect();
}

run();
