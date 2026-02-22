const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    console.log('--- Checking Feb 2023 Purchases ---');

    const startFeb2023 = new Date('2023-02-01T00:00:00Z');
    const endFeb2023 = new Date('2023-02-28T23:59:59Z');

    const purchases = await prisma.factureFournisseur.findMany({
        where: { dateEmission: { gte: startFeb2023, lte: endFeb2023 } },
        include: { fiche: true, fournisseur: true }
    });

    console.log(`Purchases found in Feb 2023: ${purchases.length}`);
    purchases.forEach(p => {
        console.log(`- ${p.numeroFacture} | ${p.type} | FicheId: ${p.ficheId} | BL: ${p.isBL} | HT: ${p.montantHT}`);
    });

    process.exit(0);
}
main();
