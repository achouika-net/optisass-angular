import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCounts() {
    console.log('Database URL:', process.env.DATABASE_URL);
    try {
        const counts = {
            paiements: await prisma.paiement.count(),
            echeances: await prisma.echeancePaiement.count(),
            depenses: await prisma.depense.count(),
            factures: await prisma.facture.count(),
            factureFournisseurs: await prisma.factureFournisseur.count(),
            mouvementStock: await prisma.mouvementStock.count(),
            fiches: await prisma.fiche.count(),
            clients: await prisma.client.count(),
            fournisseurs: await prisma.fournisseur.count(),
            points: await prisma.pointsHistory.count(),
            ops: await prisma.operationCaisse.count()
        };
        console.log('--- CURRENT ROW COUNTS ---');
        console.table(counts);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
checkCounts();
