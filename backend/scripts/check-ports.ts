import { PrismaClient } from '@prisma/client';

async function checkPort(port: number, password: string) {
    const url = `postgresql://postgres:${password}@localhost:${port}/optisaas?schema=public`;
    console.log(`\n--- Checking port ${port} with URL: ${url} ---`);

    const prisma = new PrismaClient({
        datasources: {
            db: { url }
        }
    });

    try {
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
        console.log(`Depense: ${depenseCount}`);
        console.log(`MouvementStock: ${mouvementStockCount}`);
    } catch (error) {
        console.error(`Error on port ${port}:`, error.message);
    } finally {
        await prisma.$disconnect();
    }
}

async function main() {
    // Port 5432 (from .env)
    await checkPort(5432, 'admin');

    // Port 5435 (from docker-compose)
    await checkPort(5435, 'mypassword');
}

main();
