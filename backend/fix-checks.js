const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const centreId = '456f5be0-9f01-4ea1-8d55-f17a82e85ef8'; // Rabat

    // 1. Find the echeances
    const echeances = await prisma.echeancePaiement.findMany({
        where: {
            dateEcheance: {
                gte: new Date(2025, 11, 1),
                lte: new Date(2025, 11, 31, 23, 59, 59)
            }
        }
    });

    console.log(`Fixing ${echeances.length} echeances...`);

    for (const e of echeances) {
        if (e.factureFournisseurId) {
            await prisma.factureFournisseur.update({
                where: { id: e.factureFournisseurId },
                data: { centreId }
            });
            console.log(`Updated Facture ${e.factureFournisseurId} with Centre ${centreId}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
