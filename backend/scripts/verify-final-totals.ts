import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    // Factures
    const factureMetrics = await prisma.facture.aggregate({
        _sum: { totalTTC: true },
        _count: true,
        where: {
            centreId,
            OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }],
            statut: { notIn: ['VENTE_EN_INSTANCE', 'ANNULEE', 'ARCHIVE'] },
            type: { not: 'AVOIR' }
        }
    });

    // BC
    const bcMetrics = await prisma.facture.aggregate({
        _sum: { totalTTC: true },
        _count: true,
        where: {
            centreId,
            OR: [
                { type: 'BON_COMMANDE' },
                { type: 'BON_COMM' },
                { numero: { startsWith: 'BC' } },
                { statut: 'VENTE_EN_INSTANCE' }
            ],
            statut: { notIn: ['ANNULEE', 'ARCHIVE'] }
        }
    });

    // Avoirs
    const avoirMetrics = await prisma.facture.aggregate({
        _sum: { totalTTC: true },
        _count: true,
        where: {
            centreId,
            type: 'AVOIR'
        }
    });

    // Payments
    const paymentAgg = await prisma.paiement.aggregate({
        _sum: { montant: true },
        where: {
            facture: { centreId }
        }
    });

    console.log('--- FINAL TOTALS (Port 5435) ---');
    console.log('Factures:', factureMetrics._sum.totalTTC, `(${factureMetrics._count} docs)`);
    console.log('BCs:', bcMetrics._sum.totalTTC, `(${bcMetrics._count} docs)`);
    console.log('Avoirs:', avoirMetrics._sum.totalTTC, `(${avoirMetrics._count} docs)`);
    console.log('Total Encaissé:', paymentAgg._sum.montant);

    await prisma.$disconnect();
}

run();
