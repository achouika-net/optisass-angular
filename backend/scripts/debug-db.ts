
import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        const dbs = await prisma.$queryRawUnsafe('SELECT datname FROM pg_database WHERE datistemplate = false;');
        console.log('Databases:', dbs);

        const currentDB = await prisma.$queryRawUnsafe('SELECT current_database();');
        console.log('Current Database:', currentDB);

        const counts = {
            fournisseurs: await prisma.fournisseur.count(),
            factures: await prisma.factureFournisseur.count(),
            depenses: await prisma.depense.count(),
            echeances: await prisma.echeancePaiement.count()
        };
        console.log('Counts:', counts);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
