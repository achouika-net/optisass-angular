
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const centreId = 'fc1a022c-1352-496e-b9a3-57353b6f2d57'; // Taking from a previous context or finding it

    console.log('--- AUDIT REPORT ---');
    const factures = await prisma.facture.findMany({
        include: { paiements: true },
        orderBy: { dateEmission: 'desc' }
    });

    for (const f of factures) {
        console.log(`INV|${f.numero}|${f.type}|${f.statut}|${f.totalTTC}|${f.dateEmission.toISOString()}|${f.id}`);
        for (const p of f.paiements) {
            console.log(`PAY|${p.amount || p.montant}|${p.date.toISOString()}|${p.factureId}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
