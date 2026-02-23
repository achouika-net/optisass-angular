const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
    console.log('🗑  Suppression de la facture orpheline...');

    // Find the orphan by numero and specific properties to be safe
    const orphan = await p.facture.findFirst({
        where: {
            numero: '2/2013',
            ficheId: null
        }
    });

    if (orphan) {
        console.log(`Facture trouvée : ${orphan.id} (${orphan.numero})`);
        await p.facture.delete({
            where: { id: orphan.id }
        });
        console.log('✅ Facture supprimée avec succès.');
    } else {
        console.log('❌ Aucune facture orpheline "2/2013" trouvée.');
    }

    const countF = await p.facture.count();
    const countFiche = await p.fiche.count();
    console.log(`\n📊 Nouveaux totaux :`);
    console.log(`   Factures : ${countF}`);
    console.log(`   Fiches   : ${countFiche}`);
}

run().finally(() => p.$disconnect());
