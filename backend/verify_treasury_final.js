const { PrismaClient } = require('@prisma/client');

async function verifyTreasury() {
    const prisma = new PrismaClient();
    const startDate = new Date(1970, 0, 1);
    const endDate = new Date(3000, 0, 1);

    console.log('--- Checking Refined Treasury Metrics ---');

    // Verify that echeance statuses are correctly picked up
    const echeances = await prisma.echeancePaiement.findMany({
        where: { dateEcheance: { gte: startDate, lte: endDate }, statut: { not: 'ANNULE' } },
        select: { montant: true, statut: true, factureFournisseur: { select: { type: true } } }
    });

    const inventoryTypes = [
        'ACHAT VERRES OPTIQUES',
        'ACHAT MONTURES OPTIQUES',
        'ACHAT LENTILLES DE CONTACT',
        'ACHAT ACCESSOIRES OPTIQUES',
        'ACHAT_STOCK',
    ];

    const operationalTypes = [
        'ELECTRICITE',
        'INTERNET',
        'ASSURANCE',
        'FRAIS BANCAIRES',
        'AUTRES CHARGES',
        'REGLEMENT CONSOMMATION EAU',
        'REGLEMENT SALAIRS OPTIQUES',
        'LOYER',
    ];

    let totalScheduled = 0;
    let totalScheduledCashed = 0;

    const cashedStatuses = ['ENCAISSE', 'DECAISSE', 'PAYE', 'PAYÉ', 'PAYEE', 'PAYÉE', 'SOLDE'];

    echeances.forEach(e => {
        const type = e.factureFournisseur?.type;
        const isInventory = inventoryTypes.includes(type);
        const isOperational = operationalTypes.includes(type);

        if (e.factureFournisseur && !isInventory && !isOperational) return;

        const amount = Number(e.montant || 0);
        totalScheduled += amount;

        if (cashedStatuses.includes(e.statut.toUpperCase())) {
            totalScheduledCashed += amount;
        }
    });

    console.log(`TOTAL SCHEDULED (Filtered): ${totalScheduled}`);
    console.log(`TOTAL REGLÉ (Cashed): ${totalScheduledCashed}`);

    // This should now show a non-zero value for "Cashed" if there are paid items.

    await prisma.$disconnect();
}

verifyTreasury();
