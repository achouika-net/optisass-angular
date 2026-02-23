const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
    console.log('🔍 Recherche de la facture en double...\n');

    // Case 1: Fiches with 2+ factures linked
    const fichesWithMultipleFactures = await p.fiche.findMany({
        include: { facture: true }
    });

    // Check which fiches have more than 1 facture
    // NB: Fiche model has `facture Facture?` (single relation)
    // So let's look from Facture side: factures with same ficheId
    const allFactures = await p.facture.findMany({
        select: { id: true, numero: true, type: true, statut: true, ficheId: true, totalTTC: true, dateEmission: true, clientId: true },
        orderBy: { ficheId: 'asc' }
    });

    // Find ficheIds that appear more than once
    const ficheIdCount = {};
    for (const f of allFactures) {
        if (f.ficheId) {
            ficheIdCount[f.ficheId] = (ficheIdCount[f.ficheId] || 0) + 1;
        }
    }

    const duplicateFicheIds = Object.entries(ficheIdCount).filter(([, count]) => count > 1);

    console.log(`📋 Fiches avec plusieurs factures : ${duplicateFicheIds.length}`);

    for (const [ficheId, count] of duplicateFicheIds) {
        console.log(`\n   Fiche ${ficheId.substring(0, 8)} → ${count} factures liées :`);
        const linked = allFactures.filter(f => f.ficheId === ficheId);
        for (const f of linked) {
            console.log(`     - ${f.id.substring(0, 8)} | ${f.numero} | ${f.type} | ${f.statut} | ${f.totalTTC} DH | ${f.dateEmission?.toISOString().substring(0, 10)}`);
        }
    }

    // Case 2: Factures with NO ficheId (orphans — not linked to any fiche)
    const orphanFactures = allFactures.filter(f => !f.ficheId);
    console.log(`\n📋 Factures sans fiche liée (orphelines) : ${orphanFactures.length}`);
    for (const f of orphanFactures) {
        console.log(`   ${f.id.substring(0, 8)} | ${f.numero} | ${f.type} | ${f.statut} | ${f.totalTTC} DH | ${f.dateEmission?.toISOString().substring(0, 10)} | ClientId: ${f.clientId?.substring(0, 8) || 'N/A'}`);
    }

    console.log('\n📊 Résumé :');
    console.log(`   Total Factures : ${allFactures.length}`);
    console.log(`   Avec ficheId   : ${allFactures.filter(f => f.ficheId).length}`);
    console.log(`   Sans ficheId   : ${orphanFactures.length}`);
    console.log(`   Doublons (fiche→2 factures) : ${duplicateFicheIds.length}`);
}

run().finally(() => p.$disconnect());
