const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
    // Find all BON_COMMANDE with xx/yyyy numbering that should be FACTURE
    const targets = await p.facture.findMany({
        where: {
            type: { in: ['BON_COMMANDE', 'BON_COMM'] },
            numero: { contains: '/' },
            statut: { notIn: ['ARCHIVE', 'ANNULEE'] }
        },
        include: { paiements: true }
    });

    console.log(`Found ${targets.length} BON_COMMANDE with xx/yyyy format → reclassifying to FACTURE...\n`);

    let updated = 0;
    for (const f of targets) {
        const totalPaid = f.paiements.reduce((s, pa) => s + pa.montant, 0);
        const resteAPayer = f.totalTTC - totalPaid;
        const newStatut = resteAPayer <= 0 ? 'PAYEE' : 'VALIDEE';

        await p.facture.update({
            where: { id: f.id },
            data: { type: 'FACTURE', statut: newStatut }
        });
        updated++;
        console.log(`✅ ${f.numero.padEnd(12)} → FACTURE / ${newStatut}  (TTC: ${f.totalTTC.toFixed(2)}, Payé: ${totalPaid.toFixed(2)})`);
    }

    // Final count verification
    const newTotal = await p.facture.count({ where: { type: 'FACTURE', statut: { notIn: ['ARCHIVE', 'ANNULEE'] } } });
    const newBC = await p.facture.count({ where: { type: { in: ['BON_COMMANDE', 'BON_COMM'] }, statut: { notIn: ['ARCHIVE', 'ANNULEE'] } } });

    console.log('\n─── RÉSUMÉ ──────────────────────────');
    console.log(`Documents reclassifiés  : ${updated}`);
    console.log(`Nouveau total FACTURE   : ${newTotal}  (référence: 2843)`);
    console.log(`Nouveau total BC        : ${newBC}   (référence: 10392)`);
    console.log(`Écart FACTURE           : ${newTotal - 2843}`);
    console.log(`Écart BC                : ${newBC - 10392}`);
    console.log('─────────────────────────────────────');
}

run().finally(() => p.$disconnect());
