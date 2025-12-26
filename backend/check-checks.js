const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const startDate = new Date(2025, 11, 1);
    const endDate = new Date(2025, 11, 31, 23, 59, 59);

    const echeances = await prisma.echeancePaiement.findMany({
        where: {
            dateEcheance: { gte: startDate, lte: endDate },
        },
        include: {
            depense: true,
            factureFournisseur: true
        }
    });

    console.log(`Found ${echeances.length} echeances in Dec 2025`);
    echeances.forEach(e => {
        const centreId = e.depense?.centreId || e.factureFournisseur?.centreId;
        console.log(`- ID: ${e.id}, Montant: ${e.montant}, Centre: ${centreId || 'MISSING'}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
