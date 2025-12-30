import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const startDate = new Date(2025, 11, 1); // Dec 1, 2025
    const endDate = new Date(2025, 12, 0, 23, 59, 59);

    console.log('Querying payments between', startDate, 'and', endDate);

    // Test Aggregate with DECAISSEMENT in list
    console.log('Testing Aggregate with ENCAISSE, DECAISSE, DECAISSEMENT...');
    try {
        const result = await prisma.paiement.aggregate({
            where: {
                date: { gte: startDate, lte: endDate },
                statut: { in: ['ENCAISSE', 'DECAISSE', 'DECAISSEMENT'] },
                mode: 'ESPECES',
                facture: { type: { not: 'AVOIR' } }
            },
            _sum: { montant: true }
        });
        console.log('Aggregate Result:', result);
    } catch (e) {
        console.error('Error in aggregate:', e);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
