import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Verifying table counts...');

    const [
        fournisseurCount,
        factureFournisseurCount,
        echeancePaiementCount,
        depenseCount,
        mouvementStockCount
    ] = await Promise.all([
        prisma.fournisseur.count(),
        prisma.factureFournisseur.count(),
        prisma.echeancePaiement.count(),
        prisma.depense.count(),
        prisma.mouvementStock.count()
    ]);

    console.log(`Fournisseur: ${fournisseurCount}`);
    console.log(`FactureFournisseur: ${factureFournisseurCount}`);
    console.log(`EcheancePaiement: ${echeancePaiementCount}`);
    console.log(`Depense (Total): ${depenseCount}`);
    console.log(`MouvementStock (Total): ${mouvementStockCount}`);

    await prisma.$disconnect();
}

main();
