const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
    // Find BON_COMMANDE documents with official xx/yyyy numbers (that should be FACTURE)
    const bcs = await p.facture.findMany({
        where: {
            type: { in: ['BON_COMM', 'BON_COMMANDE'] },
            numero: { contains: '/' },
            statut: { notIn: ['ARCHIVE', 'ANNULEE'] }
        },
        include: { client: { select: { nom: true, prenom: true } }, paiements: true },
        orderBy: { numero: 'asc' }
    });

    console.log(`\n🔍 Documents BC avec numérotation facture (xx/yyyy) : ${bcs.length}\n`);
    console.log('NUMERO'.padEnd(15) + 'CLIENT'.padEnd(30) + 'TYPE'.padEnd(15) + 'TTC'.padEnd(15) + 'PAIEMENTS');
    console.log('─'.repeat(85));

    for (const f of bcs) {
        const client = f.client ? `${f.client.nom || ''} ${f.client.prenom || ''}`.trim() : 'N/A';
        const paid = f.paiements.reduce((s, pa) => s + pa.montant, 0);
        console.log(
            f.numero.padEnd(15) +
            client.substring(0, 28).padEnd(30) +
            f.type.padEnd(15) +
            f.totalTTC.toFixed(2).padEnd(15) +
            paid.toFixed(2)
        );
    }

    // Count by statut
    const byStatut = {};
    for (const f of bcs) {
        byStatut[f.statut] = (byStatut[f.statut] || 0) + 1;
    }
    console.log('\n📊 Répartition par statut :');
    for (const [k, v] of Object.entries(byStatut)) console.log(`   ${k} : ${v}`);
    console.log(`\nTotal : ${bcs.length} documents qui devraient être FACTURE`);
}

run().finally(() => p.$disconnect());
