const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('🔄 Analyse des documents avec format de facturation explicite...');

    // Find all 'DEVIS' or 'BON_COMM' that possess a '/' in the number (e.g., 85/2024), indicating they are actual FACTUREs from an older system import.
    const factures = await prisma.facture.findMany({
        where: {
            // Include recently mapped BON_COMMANDE too since they might have just been translated from DEVIS due to payment script
            type: { in: ['DEVIS', 'BON_COMM', 'BON_COMMANDE', 'FICHE_TECHNIQUE', ''] },
            numero: { contains: '/' }
        }
    });

    console.log(`🔍 Trouvé ${factures.length} documents avec " / " dans leur numéro (format facture officiel).`);

    let updated = 0;
    for (const f of factures) {
        try {
            await prisma.facture.update({
                where: { id: f.id },
                data: {
                    type: 'FACTURE',  // Upgrade to official Invoice
                    // If it was already labeled as a quotation process, mark it as VALIDEE or PAYEE depending on balance
                    statut: f.resteAPayer === 0 ? 'PAYEE' : 'VALIDEE'
                }
            });
            updated++;
            console.log(`✅ Mis à jour document ${f.numero} (Ancien type: ${f.type} -> FACTURE, Statut estimé: ${f.resteAPayer === 0 ? 'PAYEE' : 'VALIDEE'})`);
        } catch (e) {
            console.error(`❌ Erreur pour ${f.numero}: ${e.message}`);
        }
    }

    console.log('--- RÉSUMÉ ---');
    console.log(`Total documents corrigés en FACTURE : ${updated}`);
}

run().finally(() => prisma.$disconnect());
