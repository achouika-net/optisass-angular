import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Verifying supplier-related data counts...');

    try {
        const movements = await prisma.mouvementStock.count({
            where: { factureFournisseurId: { not: null } }
        });
        const echeances = await prisma.echeancePaiement.count({});
        const depenses = await prisma.depense.count({
            where: { factureFournisseurId: { not: null } }
        });
        const invoices = await prisma.factureFournisseur.count({});

        console.log(`MouvementStock: ${movements}`);
        console.log(`EcheancePaiement: ${echeances}`);
        console.log(`Depense: ${depenses}`);
        console.log(`FactureFournisseur: ${invoices}`);

    } catch (error) {
        console.error('Error during verification:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
