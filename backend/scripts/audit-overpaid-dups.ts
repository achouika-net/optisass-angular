import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    const factures = await prisma.facture.findMany({
        where: { centreId },
        select: {
            id: true,
            numero: true,
            totalTTC: true,
            paiements: {
                select: {
                    id: true,
                    montant: true,
                    date: true,
                    mode: true
                }
            }
        }
    });

    let totalToFixCount = 0;
    let totalToFixAmount = 0;
    const idsToDelete: string[] = [];

    console.log('--- Overpayment Audit ---');

    for (const f of factures) {
        const totalPaid = f.paiements.reduce((sum, p) => sum + p.montant, 0);

        // If overpaid
        if (totalPaid > f.totalTTC + 0.01) { // 0.01 for rounding
            // Look for identical payments
            const seen = new Map<string, any>();
            const currentDuplicates: string[] = [];
            let overpaidAmount = totalPaid - f.totalTTC;

            for (const p of f.paiements) {
                const dateStr = p.date ? new Date(p.date).toISOString().substring(0, 16) : 'null';
                const key = `${p.montant}_${p.mode}_${dateStr}`;

                if (seen.has(key)) {
                    // It's a duplicate. Should we delete it?
                    // Only if it helps reduce the overpayment.
                    currentDuplicates.push(p.id);
                } else {
                    seen.set(key, p);
                }
            }

            if (currentDuplicates.length > 0) {
                console.log(`Facture ${f.numero}: Overpaid by ${overpaidAmount.toFixed(2)} DH. Total TTC: ${f.totalTTC}. Total Paid: ${totalPaid}. found ${currentDuplicates.length} duplicates.`);
                idsToDelete.push(...currentDuplicates);
                totalToFixCount += currentDuplicates.length;
                // Calculate amount of these duplicates
                for (const pid of currentDuplicates) {
                    const p = f.paiements.find(x => x.id === pid)!;
                    totalToFixAmount += p.montant;
                }
            }
        }
    }

    console.log(`\nFound ${totalToFixCount} strictly identical payments in overpaid invoices.`);
    console.log(`Total amount of these duplicates: ${totalToFixAmount.toFixed(2)} DH`);

    await prisma.$disconnect();
}

run();
