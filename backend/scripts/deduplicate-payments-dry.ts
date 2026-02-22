import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    const payments = await prisma.paiement.findMany({
        where: {
            facture: { centreId }
        },
        orderBy: { date: 'asc' },
        select: {
            id: true,
            montant: true,
            date: true,
            mode: true,
            factureId: true,
            facture: {
                select: { numero: true }
            }
        }
    });

    const seen = new Map<string, any[]>();
    let totalDuplicateAmount = 0;
    let duplicateCount = 0;

    for (const p of payments) {
        // Truncate date to the minute to be safe, or just the day if imports are messy
        const dateStr = p.date ? new Date(p.date).toISOString().substring(0, 16) : 'null'; // YYYY-MM-DDTHH:mm
        const key = `${p.factureId}_${p.montant}_${p.mode}_${dateStr}`;

        if (!seen.has(key)) {
            seen.set(key, [p]);
        } else {
            seen.get(key)!.push(p);
            duplicateCount++;
            totalDuplicateAmount += p.montant;
        }
    }

    console.log('--- Payment Deduplication Dry Run ---');
    console.log(`Total payments checked: ${payments.length}`);
    console.log(`Duplicates found (extra entries): ${duplicateCount}`);
    console.log(`Total duplicate amount: ${totalDuplicateAmount.toFixed(2)} DH`);

    const samples = Array.from(seen.values()).filter(list => list.length > 1).slice(0, 10);
    if (samples.length > 0) {
        console.log('\nSample Duplicates (First 10 sets):');
        samples.forEach((list, i) => {
            console.log(`Set ${i + 1}: Facture ${list[0].facture.numero}, Amount ${list[0].montant}, Mode ${list[0].mode}, Date ${list[0].date.toISOString()}`);
            console.log(`  IDs: ${list.map(x => x.id).join(', ')}`);
        });
    }

    await prisma.$disconnect();
}

run();
