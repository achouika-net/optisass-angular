const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
    console.log('🔍 Audit Profond : CA, Acomptes et Reste à Payer\n');

    const factures = await p.facture.findMany({
        where: { statut: { notIn: ['ARCHIVE', 'ANNULEE'] } },
        include: { paiements: true }
    });

    let totalTTC = 0;
    let totalReste = 0;
    let totalPaidInFacture = 0; // f.totalTTC - f.resteAPayer
    let totalPaymentsSum = 0; // Sum of f.paiements

    for (const f of factures) {
        totalTTC += f.totalTTC || 0;
        totalReste += f.resteAPayer || 0;
        totalPaidInFacture += (f.totalTTC || 0) - (f.resteAPayer || 0);

        const sumP = f.paiements.reduce((s, pa) => s + pa.montant, 0);
        totalPaymentsSum += sumP;
    }

    console.log('📊 Chiffres Optisaas (Global - Non Annulés) :');
    console.log(`   Somme Total TTC         : ${totalTTC.toLocaleString('fr-FR')} DH`);
    console.log(`   Somme Reste à Payer     : ${totalReste.toLocaleString('fr-FR')} DH`);
    console.log(`   Somme Payé (Calculé)    : ${totalPaidInFacture.toLocaleString('fr-FR')} DH`);
    console.log(`   Somme Paiements (S réels) : ${totalPaymentsSum.toLocaleString('fr-FR')} DH`);

    console.log('\n📈 Comparaison avec Excel :');
    console.log(`   Excel Total TTC         : 9 444 831,71 DH`);
    console.log(`   Excel Acompte           : 8 936 402,24 DH`);
    console.log(`   Excel Reste à Payer     :   508 429,47 DH`);

    console.log('\n📈 Écart Optisaas - Excel :');
    console.log(`   Écart TTC               : ${(totalTTC - 9444831.71).toLocaleString('fr-FR')} DH`);
    console.log(`   Écart Payé              : ${(totalPaymentsSum - 8936402.24).toLocaleString('fr-FR')} DH`);
    console.log(`   Écart Reste             : ${(totalReste - 508429.47).toLocaleString('fr-FR')} DH`);

    // Investigate 10.5M
    // Maybe it's totalTTC including ANNULEE?
    const allTTC = await p.facture.aggregate({ _sum: { totalTTC: true } });
    console.log(`\n🔎 Total TTC (Incluant ANNULEE/ARCHIVE) : ${allTTC._sum.totalTTC?.toLocaleString('fr-FR')} DH`);

    // Check if some documents were counted twice?
    // Let's check for any duplicates in numero
}

run().finally(() => p.$disconnect());
