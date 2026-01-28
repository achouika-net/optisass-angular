const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// We need to import CommissionService manually since we can't easily use NestJS DI in a simple script
// But we can just use the logic from recalculateForPeriod

async function triggerRecalculate() {
    try {
        const mois = '2026-01';

        // Find all validated/paid invoices for this month
        const factures = await prisma.facture.findMany({
            where: {
                statut: { in: ['VALIDE', 'PAYEE', 'PARTIEL', 'VENTE_EN_INSTANCE', 'BON_DE_COMMANDE'] },
                dateEmission: {
                    gte: new Date(`${mois}-01`),
                    lt: new Date(new Date(`${mois}-01`).setMonth(new Date(`${mois}-01`).getMonth() + 1))
                },
                vendeurId: { not: null }
            }
        });

        console.log(`🔄 [Manual Recalculate] Found ${factures.length} candidate invoices for ${mois}`);

        // Since we can't easily import the service, we can't run the fixed logic directly without running the app
        // But the user can just use the "Recalculate Commissions" button in the UI if it exists.
        // Wait, I already fixed the code in commission.service.ts.
        // If I run the NestJS app, it will use the fixed code.

        // However, I can't easily restart the NestJS app from here and wait for it.
        // I'll just write a script that implements the FIXED matching logic to fix existing data.

        const rules = await prisma.commissionRule.findMany();

        for (const facture of factures) {
            console.log(`Processing Facture ${facture.numero}...`);
            await prisma.commission.deleteMany({ where: { factureId: facture.id } });

            const lines = typeof facture.lignes === 'string' ? JSON.parse(facture.lignes) : facture.lignes;

            for (const line of lines) {
                let typeArticle = null;
                if (line.productId) {
                    const product = await prisma.product.findUnique({ where: { id: line.productId } });
                    if (product) typeArticle = product.typeArticle;
                }

                if (!typeArticle && line.description) {
                    const desc = line.description.toUpperCase();
                    if (desc.includes('MONTURE')) typeArticle = 'MONTURE';
                    else if (desc.includes('VERRE')) typeArticle = 'VERRE';
                    else if (desc.includes('LENTILLE')) typeArticle = 'LENTILLE';
                    else if (desc.includes('ACCESSOIRE')) typeArticle = 'ACCESSOIRE';
                }

                const rule = rules.find(r => {
                    if (!typeArticle) return false;
                    const rType = r.typeProduit.toUpperCase();
                    const pType = typeArticle.toUpperCase();
                    return rType === pType || pType.startsWith(rType + '_');
                }) || rules.find(r => r.typeProduit === 'GLOBAL');

                if (rule) {
                    const montantCom = (line.totalTTC || 0) * (rule.taux / 100);
                    if (montantCom > 0) {
                        await prisma.commission.create({
                            data: {
                                employeeId: facture.vendeurId,
                                factureId: facture.id,
                                type: typeArticle || 'INCONNU',
                                montant: montantCom,
                                mois: mois
                            }
                        });
                        console.log(`   ✅ Commission created: ${montantCom} DH (${typeArticle})`);
                    }
                }
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

triggerRecalculate();
