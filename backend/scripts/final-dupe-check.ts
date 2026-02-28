
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- FINAL PAYMENT DUPLICATE CHECK ---');

    // Look for multiple PAYEE echeances with exact same amount, date, and reference
    const dupes = await prisma.$queryRaw<any[]>`
    SELECT montant, "dateEncaissement", "reference", COUNT(*) as count 
    FROM "EcheancePaiement" 
    WHERE "statut" = 'PAYEE' 
    GROUP BY montant, "dateEncaissement", "reference" 
    HAVING COUNT(*) > 1
  `;

    console.log(`Found ${dupes.length} groups of potential duplicate payments (same amt, date, ref).`);
    for (const d of dupes.slice(0, 10)) {
        console.log(`- Amount: ${d.montant}, Date: ${d.dateEncaissement}, Ref: ${d.reference}, Count: ${d.count}`);
    }

    const totPayee = await prisma.echeancePaiement.count({ where: { statut: 'PAYEE' } });
    console.log(`\nTotal unique-ish PAYEE echeances: ${totPayee}`);

    // Count how many invoices have NO payee payment
    const unpaidInvoices = await prisma.factureFournisseur.count({
        where: { echeances: { none: { statut: 'PAYEE' } } }
    });
    console.log(`Invoices with ZERO payments: ${unpaidInvoices}`);
}

main().finally(() => prisma.$disconnect());
