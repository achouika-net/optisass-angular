const { PrismaClient } = require('@prisma/client');

async function verifyHarmonization() {
    const prisma = new PrismaClient();
    const rabat = await prisma.centre.findFirst({ where: { nom: { contains: 'RABAT', mode: 'insensitive' } } });
    const tenantId = rabat.id;

    console.log(`--- Final Harmonization Check (Centre Rabat: ${tenantId}) ---`);

    // 1. Stats Logic (Simulated getRealProfit)
    const opexTypes = ['ELECTRICITE', 'INTERNET', 'ASSURANCE', 'FRAIS BANCAIRES', 'AUTRES CHARGES', 'REGLEMENT CONSOMMATION EAU', 'REGLEMENT SALAIRS OPTIQUES', 'LOYER'];
    const inventoryTypes = ['ACHAT VERRES OPTIQUES', 'ACHAT MONTURES OPTIQUES', 'ACHAT LENTILLES DE CONTACT', 'ACHAT ACCESSOIRES OPTIQUES', 'ACHAT_STOCK'];

    const statsOpEx = await prisma.factureFournisseur.aggregate({
        where: { centreId: tenantId, OR: [{ type: { in: opexTypes } }, { type: { notIn: inventoryTypes } }] },
        _sum: { montantTTC: true }
    });
    const statsInventory = await prisma.factureFournisseur.aggregate({
        where: { centreId: tenantId, type: { in: inventoryTypes } },
        _sum: { montantTTC: true }
    });
    const statsDepense = await prisma.depense.aggregate({
        where: { centreId: tenantId },
        _sum: { montant: true }
    });

    const totalStatsExpenses = Number(statsOpEx._sum.montantTTC || 0) + Number(statsInventory._sum.montantTTC || 0) + Number(statsDepense._sum.montant || 0);

    // 2. Treasury Logic (Simulated updated getMonthlySummary)
    const treasuryInvoices = await prisma.factureFournisseur.aggregate({
        where: { centreId: tenantId },
        _sum: { montantTTC: true }
    });
    const treasuryDepensesTotal = await prisma.depense.aggregate({
        where: { centreId: tenantId },
        _sum: { montant: true }
    });

    const totalTreasuryExpenses = Number(treasuryInvoices._sum.montantTTC || 0) + Number(treasuryDepensesTotal._sum.montant || 0);

    console.log(`Stats Total (Invoice Basis): ${totalStatsExpenses.toFixed(2)}`);
    console.log(`Treasury Total (Invoice Basis): ${totalTreasuryExpenses.toFixed(2)}`);

    if (Math.abs(totalStatsExpenses - totalTreasuryExpenses) < 1) {
        console.log('✅ SUCCESS: Dashboards are now unified on the same base.');
    } else {
        console.log('❌ FAILURE: Discrepancy remains.');
    }

    // Check Solde Réel ingredients
    const cashedEcheances = await prisma.echeancePaiement.aggregate({
        where: {
            statut: { in: ['ENCAISSE', 'DECAISSE', 'PAYE', 'PAYÉ', 'PAYEE', 'PAYÉE', 'SOLDE'] },
            OR: [
                { depense: { centreId: tenantId } },
                { factureFournisseur: { centreId: tenantId } }
            ]
        },
        _sum: { montant: true }
    });

    console.log(`Amount "Réglé" (Cash Flow): ${Number(cashedEcheances._sum.montant || 0).toFixed(2)}`);

    await prisma.$disconnect();
}

verifyHarmonization();
