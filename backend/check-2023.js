const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    console.log('--- Checking 2023 Purchase Data ---');

    const start2023 = new Date('2023-01-01T00:00:00Z');
    const end2023 = new Date('2023-12-31T23:59:59Z');

    // 1. Check FactureFournisseur (Purchases)
    const purchases = await prisma.factureFournisseur.count({
        where: { dateEmission: { gte: start2023, lte: end2023 } }
    });
    console.log(`FactureFournisseur found in 2023: ${purchases}`);

    // 2. Check ANY MouvementStock in 2023
    const mvts2023 = await prisma.mouvementStock.count({
        where: { dateMovement: { gte: start2023, lte: end2023 } }
    });
    console.log(`Total MouvementStock records in 2023: ${mvts2023}`);

    // 3. Check Depense in 2023
    const dep2023 = await prisma.depense.count({
        where: { date: { gte: start2023, lte: end2023 } }
    });
    console.log(`Total Depense records in 2023: ${dep2023}`);

    // 4. Check if there are any Products with prixAchatHT > 0
    const productsWithPrice = await prisma.product.count({
        where: { prixAchatHT: { gt: 0 } }
    });
    console.log(`Products with prixAchatHT > 0: ${productsWithPrice}`);

    process.exit(0);
}
main();
