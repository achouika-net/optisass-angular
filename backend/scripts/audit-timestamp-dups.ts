import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    const payments = await prisma.paiement.findMany({
        where: { facture: { centreId } },
        select: {
            id: true,
            montant: true,
            createdAt: true,
            factureId: true,
            facture: { select: { numero: true } }
        }
    });

    const seen = new Map<string, any[]>();
    let totalDupAmount = 0;
    let count = 0;

    for (const p of payments) {
        // Exact same createdAt and amount and facture
        const key = `${p.factureId}_${p.montant}_${p.createdAt.getTime()}`;
        if (!seen.has(key)) {
            seen.set(key, [p]);
        } else {
            seen.get(key)!.push(p);
            count++;
            totalDupAmount += p.montant;
        }
    }

    console.log('--- Timestamp-based Duplicate Audit ---');
    console.log(`Duplicates found (extra entries with identical createdAt): ${count}`);
    console.log(`Total amount: ${totalDupAmount.toFixed(2)} DH`);

    if (count > 0) {
        const samples = Array.from(seen.values()).filter(list => list.length > 1).slice(0, 5);
        samples.forEach(list => {
            console.log(`Facture ${list[0].facture.numero}: ${list.length} entries of ${list[0].montant} at ${list[0].createdAt.toISOString()}`);
        });
    }

    await prisma.$disconnect();
}

run();
