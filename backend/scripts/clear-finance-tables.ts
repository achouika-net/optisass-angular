import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Début du nettoyage ciblé ---');

    // Attention à l'ordre : on supprime les enfants avant les parents pour éviter les violations de contraintes

    // 1. Dépenses (qui peuvent être liées à des Echeances, BLs, ou Factures)
    console.log('Suppression des Depenses...');
    await prisma.depense.deleteMany();

    // 2. Mouvements de stock (liés aux BLs et Factures)
    console.log('Suppression des Mouvements de Stock...');
    await prisma.mouvementStock.deleteMany();

    // 3. Demandes d'alimentation (liées aux Dépenses)
    console.log('Suppression des Demandes Alimentation...');
    await prisma.demandeAlimentation.deleteMany();

    // 4. Opérations Caisse (liées aux Dépenses/Echeances potentiellement)
    console.log('Suppression des Operations Caisse...');
    await prisma.operationCaisse.deleteMany();

    // 5. Echeances de Paiement (liées aux Factures/BLs)
    console.log('Suppression des Echeances de Paiement...');
    await prisma.echeancePaiement.deleteMany();

    // 6. Bons de Livraison (le nouveau modèle)
    console.log('Suppression des Bons de Livraison...');
    // Prisma generated code may or may not have BonLivraison yet depending on the exact sync state on user's machine,
    // but we try. If it breaks, we catch and ignore.
    try {
        if ((prisma as any).bonLivraison) {
            await (prisma as any).bonLivraison.deleteMany();
        }
    } catch (e) {
        console.log('Table BonLivraison non trouvée ou vide.');
    }

    // 7. Factures Fournisseurs (le modèle parent)
    console.log('Suppression des Factures Fournisseurs...');
    await prisma.factureFournisseur.deleteMany();

    console.log('--- Nettoyage terminé avec succès ! ---');
}

main()
    .catch((e) => {
        console.error('Erreur lors du nettoyage :', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
