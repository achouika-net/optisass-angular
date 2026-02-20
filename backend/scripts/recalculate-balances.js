const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- ⚖️ RECALCULATING INVOICE BALANCES ---');

    // Get all factures that have payments
    const factures = await prisma.facture.findMany({
        where: {
            paiements: { some: {} }
        },
        include: {
            paiements: {
                where: { statut: 'ENCAISSE' }
            }
        }
    });

    console.log(`Processing ${factures.length} factures...`);

    let updatedCount = 0;
    for (const f of factures) {
        const totalPaye = f.paiements.reduce((sum, p) => sum + p.montant, 0);
        const resteAPayer = Math.max(0, f.totalTTC - totalPaye);
        const statut = resteAPayer <= 0 ? 'PAYEE' : 'VALIDEE';

        if (Math.abs(f.resteAPayer - resteAPayer) > 0.01 || f.statut !== statut) {
            await prisma.facture.update({
                where: { id: f.id },
                data: { resteAPayer, statut }
            });
            updatedCount++;
        }
    }

    console.log(`✅ Balance recalculation complete. Updated ${updatedCount} factures.`);
}

main()
    .catch(e => console.log(e))
    .finally(() => prisma.$disconnect());
