import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public' } }
});

async function clearAllForTest() {
    console.log('🧹 Début du nettoyage des tables...\n');

    // Step 1: EcheancePaiement (dépend de FactureFournisseur et Depense)
    const echeances = await prisma.echeancePaiement.deleteMany({});
    console.log(`✅ EcheancePaiement supprimées : ${echeances.count}`);

    // Step 2: Depense (dépend de Fournisseur, FactureFournisseur)
    const depenses = await prisma.depense.deleteMany({});
    console.log(`✅ Depenses supprimées : ${depenses.count}`);

    // Step 3: Paiement clients (dépend de Facture)
    const paiements = await prisma.paiement.deleteMany({});
    console.log(`✅ Paiements clients supprimés : ${paiements.count}`);

    // Step 4: FicheProduit / LigneFacture (dépend de Facture)
    try {
        const lignes = await (prisma as any).ligneFacture.deleteMany({});
        console.log(`✅ LignesFacture supprimées : ${lignes.count}`);
    } catch { console.log('ℹ️  LigneFacture table non trouvée, ignoré.'); }

    // Step 5: Facture des ventes (dépend de Client, Fiche)
    const factures = await prisma.facture.deleteMany({});
    console.log(`✅ Factures ventes supprimées : ${factures.count}`);

    // Step 6: FactureFournisseur (dépend de Fournisseur)
    const facturesFourn = await prisma.factureFournisseur.deleteMany({});
    console.log(`✅ FacturesFournisseur supprimées : ${facturesFourn.count}`);

    // Step 7: Fournisseur
    const fournisseurs = await prisma.fournisseur.deleteMany({});
    console.log(`✅ Fournisseurs supprimés : ${fournisseurs.count}`);

    // Step 8: Fiches médicales (dossiers clients)
    const fiches = await prisma.fiche.deleteMany({});
    console.log(`✅ Fiches (dossiers clients) supprimées : ${fiches.count}`);

    console.log('\n✅ Nettoyage terminé ! La base est prête pour un test propre.');
    await prisma.$disconnect();
}

clearAllForTest().catch(async (e) => {
    console.error('❌ Erreur :', e.message);
    await prisma.$disconnect();
    process.exit(1);
});
