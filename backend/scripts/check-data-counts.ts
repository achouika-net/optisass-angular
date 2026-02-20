import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDataCounts() {
    console.log('=== Vérification des données importées ===\n');

    // Count FactureFournisseur
    const invoiceCount = await prisma.factureFournisseur.count();
    console.log(`📄 FactureFournisseur: ${invoiceCount} enregistrements`);

    // Count Depense
    const expenseCount = await prisma.depense.count();
    console.log(`💰 Depense: ${expenseCount} enregistrements`);

    // Count EcheancePaiement
    const echeanceCount = await prisma.echeancePaiement.count();
    console.log(`📅 EcheancePaiement: ${echeanceCount} enregistrements`);

    // Count Paiement (client payments)
    const paiementCount = await prisma.paiement.count();
    console.log(`💳 Paiement (Clients): ${paiementCount} enregistrements`);

    console.log('\n=== Détails des factures fournisseurs ===');
    const invoicesByStatus = await prisma.factureFournisseur.groupBy({
        by: ['statut'],
        _count: true
    });
    console.log('Par statut:', invoicesByStatus);

    console.log('\n=== Détails des dépenses ===');
    const expensesByCategory = await prisma.depense.groupBy({
        by: ['categorie'],
        _count: true
    });
    console.log('Par catégorie:', expensesByCategory);

    console.log('\n=== Échéances par statut ===');
    const echeancesByStatus = await prisma.echeancePaiement.groupBy({
        by: ['statut'],
        _count: true
    });
    console.log('Par statut:', echeancesByStatus);

    await prisma.$disconnect();
}

checkDataCounts().catch(console.error);
