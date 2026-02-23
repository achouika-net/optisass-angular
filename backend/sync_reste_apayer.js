const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
    console.log('🔄 Synchronisation des Restes à Payer avec les Paiements réels...\n');

    const factures = await p.facture.findMany({
        include: { paiements: true }
    });

    console.log(`Traitement de ${factures.length} documents...`);

    let updated = 0;
    for (const f of factures) {
        const totalPaid = f.paiements.reduce((sum, pa) => sum + pa.montant, 0);
        const newReste = Math.max(0, (f.totalTTC || 0) - totalPaid);

        // Update if status or reste changed (to be efficient)
        // Also update statut if fully paid
        let newStatut = f.statut;
        if (newReste <= 0 && (f.statut === 'VALIDEE' || f.statut === 'VALIDE' || f.statut === 'VENTE_EN_INSTANCE')) {
            newStatut = 'PAYEE';
        }

        if (Math.abs(f.resteAPayer - newReste) > 0.01 || f.statut !== newStatut) {
            await p.facture.update({
                where: { id: f.id },
                data: {
                    resteAPayer: newReste,
                    statut: newStatut
                }
            });
            updated++;
        }
    }

    console.log(`✅ Mise à jour terminée : ${updated} documents synchronisés.`);

    // Final audit
    const stats = await p.facture.aggregate({
        _sum: { totalTTC: true, resteAPayer: true }
    });
    const paidSum = await p.paiement.aggregate({ _sum: { montant: true } });

    console.log('\n📊 Nouveaux Chiffres Optisaas :');
    console.log(`   Total TTC   : ${stats._sum.totalTTC.toLocaleString('fr-FR')} DH`);
    console.log(`   Total Payé  : ${paidSum._sum.montant.toLocaleString('fr-FR')} DH`);
    console.log(`   Total Reste : ${stats._sum.resteAPayer.toLocaleString('fr-FR')} DH`);
    console.log(`   Vérif Sum   : ${(paidSum._sum.montant + stats._sum.resteAPayer).toLocaleString('fr-FR')} DH`);
}

run().finally(() => p.$disconnect());
