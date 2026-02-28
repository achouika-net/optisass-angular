
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- DEEP AUDIT: WHY DO WE HAVE 2136? ---');

    const totEcheances = await prisma.echeancePaiement.count();
    const totPayee = await prisma.echeancePaiement.count({ where: { statut: 'PAYEE' } });
    const totAttente = await prisma.echeancePaiement.count({ where: { statut: 'EN_ATTENTE' } });
    const totFactures = await prisma.factureFournisseur.count();
    const totDepenses = await prisma.depense.count();

    console.log(`Summary: ${totEcheances} Echeances (${totPayee} PAYEE, ${totAttente} EN_ATTENTE)`);
    console.log(`Debts: ${totFactures} Factures, ${totDepenses} Depenses (Total: ${totFactures + totDepenses})`);

    // 1. Look for invoices with multiple PAYEE payments
    const multiPayments = await prisma.$queryRaw<any[]>`
    SELECT "factureFournisseurId", "numeroFacture", COUNT(*) as count
    FROM "EcheancePaiement" ep
    JOIN "FactureFournisseur" ff ON ep."factureFournisseurId" = ff."id"
    WHERE ep."statut" = 'PAYEE'
    GROUP BY "factureFournisseurId", "numeroFacture"
    HAVING COUNT(*) > 1
    LIMIT 20
  `;
    console.log('Invoices with multiple PAYEE payments (Sample):', JSON.stringify(multiPayments, null, 2));

    // 2. Check for duplicate NumeroFacture under different suppliers
    const dupNums = await prisma.$queryRaw<any[]>`
    SELECT "numeroFacture", COUNT(DISTINCT "fournisseurId") as suppliers
    FROM "FactureFournisseur"
    GROUP BY "numeroFacture"
    HAVING COUNT(DISTINCT "fournisseurId") > 1
  `;
    console.log('Invoices numbers used across different suppliers:', JSON.stringify(dupNums, null, 2));

    // 3. Find the 9 extra invoices
    const extraInvoices = await prisma.factureFournisseur.findMany({
        where: { referenceInterne: { contains: 'AUTO-CREATED' } },
        include: { fournisseur: true }
    });
    console.log('9 Extra Invoices details:', extraInvoices.map(f => ({
        id: f.id,
        num: f.numeroFacture,
        supplier: f.fournisseur.nom,
        createdAt: f.createdAt
    })));

    // 4. Trace the most recent 259 echeances
    const recentSuccess = await prisma.echeancePaiement.findMany({
        where: { remarque: { in: ['ADDITIONAL PAYMENT', 'AUTO-CREATED FROM UNMATCHED PAYMENT'] as any[] } },
        take: 10,
        include: { factureFournisseur: true },
        orderBy: { createdAt: 'desc' }
    });
    console.log('Details of 10 recent "Successful" import creations:', JSON.stringify(recentSuccess.map(e => ({
        amt: e.montant,
        date: e.dateEncaissement,
        remarque: e.remarque,
        num: e.factureFournisseur?.numeroFacture
    })), null, 2));
}

main().finally(() => prisma.$disconnect());
