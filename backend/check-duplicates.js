
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Scanning Recent Invoices ---');
    const factures = await prisma.facture.findMany({
        where: {
            OR: [
                { numero: { startsWith: 'FAC' } },
                { numero: { startsWith: 'Devis' } },
                { type: 'AVOIR' }
            ]
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
            id: true,
            numero: true,
            type: true,
            statut: true,
            ficheId: true,
            totalTTC: true,
            updatedAt: true,
            createdAt: true,
            proprietes: true
        }
    });

    console.log(JSON.stringify(factures, null, 2));

    // Check specifically for duplicates on a fiche
    const duplicates = await prisma.facture.groupBy({
        by: ['ficheId'],
        where: { NOT: { ficheId: null } },
        _count: { ficheId: true },
        having: { ficheId: { _count: { gt: 1 } } }
    });

    if (duplicates.length > 0) {
        console.log('\n--- Fiches with multiple invoices ---');
        for (const d of duplicates) {
            const fichesFactures = await prisma.facture.findMany({
                where: { ficheId: d.ficheId },
                select: { id: true, numero: true, type: true, statut: true, createdAt: true }
            });
            console.log(`Fiche ${d.ficheId}:`, fichesFactures);
        }
    } else {
        console.log('\nNo duplicate ficheId found (due to unique constraint likely).');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
