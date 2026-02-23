const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('🔄 Démarrage de l\'unification des documents avec paiements...');

    // Find all documents that have payments but are NOT officially FACTURE or BL
    const factures = await prisma.facture.findMany({
        where: {
            type: { notIn: ['FACTURE', 'BL', 'AVOIR'] },
            statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
            paiements: { some: {} }, // Must have at least one payment
            OR: [
                { type: 'DEVIS' },
                { type: '' },
                { type: 'FICHE_TECHNIQUE' },
                // Even some BON_COMM with BROUILLON status
                { statut: 'BROUILLON' }
            ]
        }
    });

    console.log(`🔍 Trouvé ${factures.length} documents devant être convertis en Bon de Commande...`);

    let updated = 0;
    for (const f of factures) {
        let newStatut = f.statut;
        // If it was BROUILLON, it should become VENTE_EN_INSTANCE
        if (f.statut === 'BROUILLON' || !f.statut) {
            newStatut = 'VENTE_EN_INSTANCE';
        }

        try {
            await prisma.facture.update({
                where: { id: f.id },
                data: {
                    type: 'BON_COMMANDE',  // Standardize type
                    statut: newStatut
                }
            });
            updated++;
            console.log(`✅ Mis à jour document ${f.numero} (Ancien type: ${f.type}, Nouveau Statut: ${newStatut})`);
        } catch (e) {
            console.error(`❌ Erreur pour ${f.numero}: ${e.message}`);
        }
    }

    console.log('--- RÉSUMÉ ---');
    console.log(`Total documents mis à jour : ${updated}`);
}

run().finally(() => prisma.$disconnect());
