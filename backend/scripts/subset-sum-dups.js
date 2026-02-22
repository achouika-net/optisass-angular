const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const target = 16450.04;
    const tolerance = 1; // 1 DH tolerance

    const payments = await prisma.paiement.findMany({
        where: { facture: { centreId: '6df7de62-498e-4784-b22f-7bbccc7fea36' } },
        select: { id: true, montant: true, date: true, mode: true, factureId: true }
    });

    const seen = new Map();
    const duplicateEntries = [];

    for (const p of payments) {
        const d = p.date ? new Date(p.date).toISOString().substring(0, 10) : 'null';
        const key = `${p.factureId}_${p.montant}_${p.mode}_${d}`;
        if (!seen.has(key)) {
            seen.set(key, p);
        } else {
            duplicateEntries.push(p);
        }
    }

    console.log(`Potential Dup Entries: ${duplicateEntries.length}`);

    // Sort duplicates by amount descending to find big ones
    duplicateEntries.sort((a, b) => b.montant - a.montant);

    let currentSum = 0;
    const picked = [];
    for (const d of duplicateEntries) {
        if (currentSum + d.montant <= target + tolerance) {
            currentSum += d.montant;
            picked.push(d);
        }
    }

    console.log(`Greedy Match Sum: ${currentSum.toFixed(2)}`);
    console.log(`Count: ${picked.length}`);

    if (Math.abs(currentSum - target) < tolerance) {
        console.log('FOUND A SUBSET MATCHING TARGET!');
        console.log(picked.map(p => ({ num: p.factureId, amount: p.montant, date: p.date })));
    } else {
        console.log('No exact greedy match found.');
    }

    await prisma.$disconnect();
}

run();
