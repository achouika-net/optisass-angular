const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('📊 AUDIT DE COMPARAISON OPTISAAS vs ANCIENNE APPLICATION\n');
    console.log('═'.repeat(70));

    // ─── 1. Fiches médicales ───────────────────────────────────────────────
    const fichesTotal = await prisma.fiche.count();
    const fichesMonture = await prisma.fiche.count({ where: { type: 'MONTURE' } });
    const fichesLentilles = await prisma.fiche.count({ where: { type: { in: ['LENTILLE', 'LENTILLES'] } } });
    const fichesOther = fichesTotal - fichesMonture - fichesLentilles;

    console.log('\n🗂  FICHES MÉDICALES');
    console.log(`   Référence ancienne app : 13 235  (M=6860, L=6375)`);
    console.log(`   Optisaas total         : ${fichesTotal.toLocaleString()}`);
    console.log(`   Optisaas MONTURE (M)   : ${fichesMonture.toLocaleString()}`);
    console.log(`   Optisaas LENTILLES (L) : ${fichesLentilles.toLocaleString()}`);
    console.log(`   Optisaas AUTRE         : ${fichesOther.toLocaleString()}`);
    if (fichesTotal === 13235) console.log('   ✅ CORRESPONDANCE EXACTE');
    else console.log(`   ⚠️  ÉCART: ${fichesTotal - 13235}`);

    // ─── 2. Factures ──────────────────────────────────────────────────────
    const facturesCount = await prisma.facture.count({ where: { type: 'FACTURE', statut: { notIn: ['ARCHIVE', 'ANNULEE'] } } });
    const facturesSumRaw = await prisma.facture.aggregate({ _sum: { totalTTC: true }, where: { type: 'FACTURE', statut: { notIn: ['ARCHIVE', 'ANNULEE'] } } });
    const facturesSum = facturesSumRaw._sum.totalTTC || 0;

    console.log('\n🧾 FACTURES VALIDÉES');
    console.log(`   Référence ancienne app : 2 843 factures — 5 881 132,04 DH`);
    console.log(`   Optisaas count         : ${facturesCount.toLocaleString()}`);
    console.log(`   Optisaas CA (factures) : ${facturesSum.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH`);
    if (facturesCount === 2843) console.log('   ✅ CORRESPONDANCE EXACTE');
    else console.log(`   ⚠️  ÉCART: ${facturesCount - 2843} factures`);

    // ─── 3. Bons de Commande / Ventes sans facture ─────────────────────────
    const bonComCount = await prisma.facture.count({ where: { type: { in: ['BON_COMMERCIALE', 'BON_COMM', 'BON_COMMANDE'] }, statut: { notIn: ['ARCHIVE', 'ANNULEE'] } } });
    const bonComSumRaw = await prisma.facture.aggregate({ _sum: { totalTTC: true }, where: { type: { in: ['BON_COMMERCIALE', 'BON_COMM', 'BON_COMMANDE'] }, statut: { notIn: ['ARCHIVE', 'ANNULEE'] } } });
    const bonComSum = bonComSumRaw._sum.totalTTC || 0;

    console.log('\n🛒 VENTES SANS FACTURE (Bons de Commande)');
    console.log(`   Référence ancienne app : 10 392`);
    console.log(`   Optisaas count         : ${bonComCount.toLocaleString()}`);
    console.log(`   Optisaas CA (BC)       : ${bonComSum.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH`);
    if (bonComCount === 10392) console.log('   ✅ CORRESPONDANCE EXACTE');
    else console.log(`   ⚠️  ÉCART: ${bonComCount - 10392} documents`);

    // ─── 4. CA Global ─────────────────────────────────────────────────────
    const paiementsTotal = await prisma.paiement.aggregate({ _sum: { montant: true } });
    const caTotal = paiementsTotal._sum.montant || 0;

    console.log('\n💰 CHIFFRE D\'AFFAIRES ENCAISSÉ (Paiements)');
    console.log(`   Référence ancienne app : 8 954 772,28 DH`);
    console.log(`   Optisaas (paiements)   : ${caTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH`);
    const ecartCA = Math.round((caTotal - 8954772.28) * 100) / 100;
    if (Math.abs(ecartCA) < 1) console.log('   ✅ CORRESPONDANCE EXACTE');
    else console.log(`   ⚠️  ÉCART: ${ecartCA.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH`);

    // ─── 5. Paiements par méthode ─────────────────────────────────────────
    const payByMethod = await prisma.paiement.groupBy({ by: ['mode'], _sum: { montant: true } });
    console.log('\n📋 PAIEMENTS PAR MÉTHODE');
    for (const p of payByMethod.sort((a, b) => (b._sum.montant || 0) - (a._sum.montant || 0))) {
        console.log(`   ${(p.mode || 'INCONNU').padEnd(20)} : ${(p._sum.montant || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH`);
    }

    // ─── 6. Résumé total ──────────────────────────────────────────────────
    const totalDocs = facturesCount + bonComCount;
    console.log('\n═'.repeat(70));
    console.log('📌 RÉSUMÉ GLOBAL');
    console.log(`   Total fiches      : ${fichesTotal}  (référence: 13 235)`);
    console.log(`   Total factures    : ${facturesCount}  (référence: 2 843)`);
    console.log(`   Total BC/Ventes   : ${bonComCount}  (référence: 10 392)`);
    console.log(`   Tous docs vente   : ${totalDocs}  (référence: 13 235)`);
    console.log(`   CA total encaissé : ${caTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH  (référence: 8 954 772,28 DH)`);
    console.log('═'.repeat(70));
}

run().finally(() => prisma.$disconnect());
