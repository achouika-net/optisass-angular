import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting to clear Facture and Paiement tables...');

    try {
        // 1. Commission - Directly dependent on Facture
        const commissions = await prisma.commission.deleteMany({});
        console.log(`✅ Deleted ${commissions.count} commissions.`);

        // 2. Paiement - Directly dependent on Facture
        const paiements = await prisma.paiement.deleteMany({});
        console.log(`✅ Deleted ${paiements.count} paiements.`);

        // 3. MouvementStock - Disconnect from Facture
        const mouvements = await prisma.mouvementStock.updateMany({
            where: { factureId: { not: null } },
            data: { factureId: null }
        });
        console.log(`✅ Disconnected ${mouvements.count} stock movements from factures.`);

        // 4. OperationCaisse - Disconnect from Facture
        const operations = await prisma.operationCaisse.updateMany({
            where: { factureId: { not: null } },
            data: { factureId: null }
        });
        console.log(`✅ Disconnected ${operations.count} cash operations from factures.`);

        // 5. PointsHistory - Disconnect from Facture
        const points = await prisma.pointsHistory.updateMany({
            where: { factureId: { not: null } },
            data: { factureId: null }
        });
        console.log(`✅ Disconnected ${points.count} points history records from factures.`);

        // 6. DemandeAlimentation - Disconnect from Paiement
        const demandes = await prisma.demandeAlimentation.updateMany({
            where: { paiementId: { not: null } },
            data: { paiementId: null }
        });
        console.log(`✅ Disconnected ${demandes.count} replenishment requests from payments.`);

        // 7. FactureFournisseur - Disconnect from Fiche
        const supplierInvoices = await prisma.factureFournisseur.updateMany({
            where: { ficheId: { not: null } },
            data: { ficheId: null }
        });
        console.log(`✅ Disconnected ${supplierInvoices.count} supplier invoices from fiches.`);

        // 8. Facture - Delete all factures
        const factures = await prisma.facture.deleteMany({});
        console.log(`✅ Deleted ${factures.count} factures.`);

        // 9. Fiche - Finally, delete all fiches
        const fiches = await prisma.fiche.deleteMany({});
        console.log(`✅ Deleted ${fiches.count} fiches.`);

        console.log('✨ All requested data (Facture, Paiement, Fiche) cleared successfully.');
    } catch (error) {
        console.error('❌ Error clearing sales data:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
