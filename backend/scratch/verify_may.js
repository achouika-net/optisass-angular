const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public"
        }
    }
});

async function verifyMay() {
    try {
        const startMay = new Date('2026-05-01T00:00:00Z');
        const endMay = new Date('2026-05-31T23:59:59Z');

        console.log('Verifying May 2026 stats...');

        const echeances = await prisma.echeancePaiement.findMany({
            where: {
                dateEcheance: { gte: startMay, lte: endMay },
                statut: { not: 'ANNULE' }
            }
        });

        const totalScheduled = echeances.reduce((sum, e) => sum + Number(e.montant), 0);
        const paid = echeances
            .filter(e => ['ENCAISSE', 'PAYE', 'PAYÉ', 'SOLDE'].includes(e.statut.toUpperCase()))
            .reduce((sum, e) => sum + Number(e.montant), 0);
        const pending = echeances
            .filter(e => ['EN_ATTENTE', 'A_PAYER'].includes(e.statut.toUpperCase()))
            .reduce((sum, e) => sum + Number(e.montant), 0);

        console.log(`Total Scheduled: ${totalScheduled} DH`);
        console.log(`Paid: ${paid} DH`);
        console.log(`Pending: ${pending} DH`);
        console.log('Echeances detail:', JSON.stringify(echeances.map(e => ({ id: e.id, montant: e.montant, statut: e.statut, bl: e.bonLivraisonId, ff: e.factureFournisseurId })), null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

verifyMay();
