import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Exact logic from TreasuryService
    const year = 2025;
    const month = 12;
    const centreId = '456f5be0-9f01-4ea1-8d55-f17a82e85ef8'; // Rabat

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const incomingStandard = await prisma.paiement.aggregate({
        where: {
            date: { gte: startDate, lte: endDate },
            statut: { in: ['ENCAISSE', 'DECAISSE', 'DECAISSEMENT'] },
            facture: { type: { not: 'AVOIR' }, centreId }
        },
        _sum: { montant: true }
    });

    const incomingAvoir = await prisma.paiement.aggregate({
        where: {
            date: { gte: startDate, lte: endDate },
            statut: { in: ['ENCAISSE', 'DECAISSE', 'DECAISSEMENT'] },
            facture: { type: 'AVOIR', centreId }
        },
        _sum: { montant: true }
    });

    const incomingCashStandard = await prisma.paiement.aggregate({
        where: {
            date: { gte: startDate, lte: endDate },
            statut: { in: ['ENCAISSE', 'DECAISSE', 'DECAISSEMENT'] },
            mode: 'ESPECES',
            facture: { type: { not: 'AVOIR' }, centreId }
        },
        _sum: { montant: true }
    });

    const incomingCashAvoir = await prisma.paiement.aggregate({
        where: {
            date: { gte: startDate, lte: endDate },
            statut: { in: ['ENCAISSE', 'DECAISSE', 'DECAISSEMENT'] },
            mode: 'ESPECES',
            facture: { type: 'AVOIR', centreId } // This might be where Avoir check is WRONG in my code if refund invoice is FACTURE type
        },
        _sum: { montant: true }
    });

    console.log('Results:');
    console.log('Total Standard:', incomingStandard._sum.montant);
    console.log('Total Avoir:', incomingAvoir._sum.montant);
    console.log('Cash Standard:', incomingCashStandard._sum.montant);
    console.log('Cash Avoir:', incomingCashAvoir._sum.montant);

    const totalIncoming = (incomingStandard._sum.montant || 0) - (incomingAvoir._sum.montant || 0);
    const cashTotal = (incomingCashStandard._sum.montant || 0) - (incomingCashAvoir._sum.montant || 0);

    console.log('Final Calculated Cash:', cashTotal);
    console.log('Final Total Recettes:', totalIncoming);
}

main().catch(console.error).finally(() => prisma.$disconnect());
