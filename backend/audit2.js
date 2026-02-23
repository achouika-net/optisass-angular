const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
    const ficheTotal = await p.fiche.count();
    const ficheM = await p.fiche.count({ where: { type: 'MONTURE' } });
    const ficheL = await p.fiche.count({ where: { type: { in: ['LENTILLE', 'LENTILLES', 'LENTILLE_CONTACT'] } } });
    const factCount = await p.facture.count({ where: { type: 'FACTURE', statut: { notIn: ['ARCHIVE', 'ANNULEE'] } } });
    const factSum = await p.facture.aggregate({ _sum: { totalTTC: true }, where: { type: 'FACTURE', statut: { notIn: ['ARCHIVE', 'ANNULEE'] } } });
    const bonCount = await p.facture.count({ where: { type: { in: ['BON_COMM', 'BON_COMMANDE'] }, statut: { notIn: ['ARCHIVE', 'ANNULEE'] } } });
    const payTotal = await p.paiement.aggregate({ _sum: { montant: true } });
    const payByMode = await p.paiement.groupBy({ by: ['mode'], _sum: { montant: true } });

    const fmt = (n) => (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });

    console.log('\n📊 RAPPORT DE RÉCONCILIATION\n' + '═'.repeat(55));
    console.log('');
    console.log('🗂  FICHES MÉDICALES');
    console.log('   Référence  : 13 235  (M=6860 / L=6375)');
    console.log(`   Optisaas   : ${ficheTotal}  (M=${ficheM} / L=${ficheL} / Autre=${ficheTotal - ficheM - ficheL})`);
    console.log(`   Écart      : ${ficheTotal - 13235}`);

    console.log('');
    console.log('🧾 FACTURES VALIDÉES');
    console.log('   Référence  : 2 843  (5 881 132,04 DH)');
    console.log(`   Optisaas   : ${factCount}  (${fmt(factSum._sum.totalTTC)} DH)`);
    console.log(`   Écart      : ${factCount - 2843} factures`);

    console.log('');
    console.log('🛒 VENTES SANS FACTURE (Bons de Commande)');
    console.log('   Référence  : 10 392');
    console.log(`   Optisaas   : ${bonCount}`);
    console.log(`   Écart      : ${bonCount - 10392}`);

    console.log('');
    console.log('💰 CA TOTAL ENCAISSÉ');
    console.log('   Référence  : 8 954 772,28 DH');
    console.log(`   Optisaas   : ${fmt(payTotal._sum.montant)} DH`);
    console.log(`   Écart      : ${fmt((payTotal._sum.montant || 0) - 8954772.28)} DH`);

    console.log('');
    console.log('📋 PAIEMENTS PAR MODE');
    payByMode.sort((a, b) => (b._sum.montant || 0) - (a._sum.montant || 0)).forEach(x => {
        console.log(`   ${(x.mode || '?').padEnd(20)} : ${fmt(x._sum.montant)} DH`);
    });
    console.log('═'.repeat(55));
}

run().finally(() => p.$disconnect());
