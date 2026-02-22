import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    // 1. Audit Null Dates
    const docs = await prisma.facture.findMany({
        where: { centreId, statut: { notIn: ['ANNULEE', 'ARCHIVE'] } }
    });

    let factureNullDate = 0;
    let bcNullDate = 0;

    for (const f of docs) {
        const isFacture = (f.numero || '').startsWith('FAC') || f.type === 'FACTURE';
        const isInteance = f.statut === 'VENTE_EN_INSTANCE';
        const isBC = f.type === 'BON_COMMANDE' || f.type === 'BON_COMM' || (f.numero || '').startsWith('BC');

        if (isFacture && !isInteance && !f.dateEmission) {
            factureNullDate += (f.totalTTC || 0);
        }
        if ((isInteance || isBC) && !f.dateEmission) {
            bcNullDate += (f.totalTTC || 0);
        }
    }

    console.log('--- Date Issues Audit ---');
    console.log('Factures (Valid) with NULL date Total:', factureNullDate);
    console.log('BCs with NULL date Total:', bcNullDate);

    // 2. Audit Duplicate Payments
    const paiements = await prisma.paiement.findMany({
        where: { facture: { centreId } },
        orderBy: { date: 'asc' }
    });

    let duplicateTotal = 0;
    const seen = new Set();

    for (const p of paiements) {
        // Unique key: Facture + Amount + Date (truncated to day) + Mode
        const dateStr = p.date ? new Date(p.date).toISOString().split('T')[0] : 'null';
        const key = `${p.factureId}_${p.montant}_${dateStr}_${p.mode}`;
        if (seen.has(key)) {
            duplicateTotal += p.montant;
        } else {
            seen.add(key);
        }
    }

    console.log('\n--- Duplicate Payments Audit ---');
    console.log('Estimated duplicate payments amount:', duplicateTotal);

    // 3. Find specifically the 1,155,000 difference in BC entries
    // Excel BC Total: ~3.56M
    // System BC Total: 4.71M
    // Difference: ~1.15M

    // Let's see if there are many BCs with the same amount or something
    const bcs = docs.filter(f => (f.statut === 'VENTE_EN_INSTANCE' || f.type === 'BON_COMMANDE' || f.type === 'BON_COMM' || (f.numero || '').startsWith('BC')));
    console.log('\n--- BC Overview ---');
    console.log('Total BC Count:', bcs.length);
    console.log('Total BC TTC:', bcs.reduce((s, x) => s + (x.totalTTC || 0), 0));

    await prisma.$disconnect();
}

run();
