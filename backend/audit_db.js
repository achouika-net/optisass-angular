
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- FACTURES ---');
    const factures = await prisma.facture.findMany({
        include: { paiements: true },
        orderBy: { dateEmission: 'desc' }
    });

    factures.forEach(f => {
        const paid = f.paiements.reduce((sum, p) => sum + p.montant, 0);
        console.log(`[${f.numero}] Type: ${f.type}, Status: ${f.statut}, Total: ${f.totalTTC}, Paid: ${paid}, Date: ${f.dateEmission.toISOString()}, ID: ${f.id}`);
    });

    console.log('\n--- PAIEMENTS ---');
    const paiements = await prisma.paiement.findMany({
        orderBy: { date: 'desc' }
    });

    paiements.forEach(p => {
        console.log(`[PAY] FactureID: ${p.factureId}, Amount: ${p.montant}, Date: ${p.date.toISOString()}`);
    });

    const totalPaidPaiements = paiements.reduce((sum, p) => sum + p.montant, 0);
    console.log(`\nTOTAL CASH IN DB: ${totalPaidPaiements}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
