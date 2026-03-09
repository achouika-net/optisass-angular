const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const unusedRedemptions = await prisma.rewardRedemption.findMany({
        where: { isUsed: false, paiementId: null },
        orderBy: { redeemedAt: 'asc' }
    });

    console.log(`Found ${unusedRedemptions.length} unused redemptions.`);

    for (const redemption of unusedRedemptions) {
        const oldestUnpaidInvoice = await prisma.facture.findFirst({
            where: {
                clientId: redemption.clientId,
                statut: { notIn: ['PAYEE', 'ANNULEE'] },
                resteAPayer: { gt: 0 }
            },
            orderBy: { dateEmission: 'asc' }
        });

        if (oldestUnpaidInvoice && typeof oldestUnpaidInvoice.resteAPayer === 'number') {
            const montantAReduire = Math.min(redemption.madValue, oldestUnpaidInvoice.resteAPayer);
            const nouveauReste = oldestUnpaidInvoice.resteAPayer - montantAReduire;
            const newStatut = nouveauReste <= 0.05 ? 'PAYEE' : 'PARTIEL';

            const paiement = await prisma.paiement.create({
                data: {
                    factureId: oldestUnpaidInvoice.id,
                    montant: montantAReduire,
                    mode: 'FIDELIO',
                    date: new Date(),
                    reference: 'BONUS_FIDELIO_RATT',
                    notes: `Application rattrapage prime de fidélité.`,
                }
            });

            await prisma.rewardRedemption.update({
                where: { id: redemption.id },
                data: { isUsed: true, paiementId: paiement.id }
            });

            await prisma.facture.update({
                where: { id: oldestUnpaidInvoice.id },
                data: {
                    resteAPayer: nouveauReste,
                    statut: oldestUnpaidInvoice.statut === 'BROUILLON' ? 'BROUILLON' : newStatut
                }
            });
            console.log(`✅ Applied ${montantAReduire} MAD to invoice ${oldestUnpaidInvoice.numero}`);
        } else {
            console.log(`⚠️ No unpaid invoice found for client ${redemption.clientId}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
