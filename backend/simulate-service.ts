import { PrismaClient } from '@prisma/client';

async function simulateService() {
    const prisma = new PrismaClient();
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    console.log(`--- Simulating UPDATED SalesControlService.getDashboardData for ${centreId} ---`);

    const FINAL_STATUSES = ['PAYEE', 'VALIDEE', 'SOLDEE', 'PARTIEL', 'ENCAISSE'];

    // Updated Factures query (same as new getValidInvoices)
    const factureWhere = {
        centreId,
        type: { not: 'AVOIR' },
        statut: { notIn: ['VENTE_EN_INSTANCE', 'ANNULEE', 'ARCHIVE', 'BROUILLON'] },
        OR: [
            { numero: { startsWith: 'FAC' } },
            { type: 'FACTURE' },
            { AND: [{ statut: { in: FINAL_STATUSES } }] }
        ]
    };

    const facturesCount = await prisma.facture.count({ where: factureWhere });
    const factureAggregate = await prisma.facture.aggregate({
        _sum: { totalTTC: true },
        _count: true,
        where: factureWhere
    });

    console.log('Count Factures (Updated logic):', facturesCount);
    console.log('Aggregate:', JSON.stringify(factureAggregate, null, 2));

    const sample = await prisma.facture.findMany({
        where: factureWhere,
        take: 5,
        select: { numero: true, type: true, statut: true }
    });
    console.log('Sample returned:', sample);

    await prisma.$disconnect();
}

simulateService();
