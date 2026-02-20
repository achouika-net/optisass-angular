const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- 🔍 AUDITING PAYMENTS (FIXED JS) ---');
    const total = await prisma.paiement.count();
    console.log(`Total payments in DB: ${total}`);

    const payments = await prisma.paiement.findMany({
        select: {
            id: true,
            factureId: true,
            date: true,
            montant: true,
            mode: true
        }
    });

    console.log(`Processing ${payments.length} records...`);

    const seen = new Set();
    const toDelete = [];

    for (const p of payments) {
        // Compose a key to identify identical payments
        const key = `${p.factureId}_${p.date ? p.date.toISOString() : ''}_${p.montant}_${p.mode}`;
        if (seen.has(key)) {
            toDelete.push(p.id);
        } else {
            seen.add(key);
        }
    }

    console.log(`Found ${toDelete.length} duplicates to delete.`);

    if (toDelete.length > 0) {
        for (let i = 0; i < toDelete.length; i += 1000) {
            const batch = toDelete.slice(i, i + 1000);
            await prisma.paiement.deleteMany({
                where: { id: { in: batch } }
            });
            console.log(`Deleted batch ${i / 1000 + 1}...`);
        }
    }

    const newTotal = await prisma.paiement.count();
    console.log(`✅ Deduplication complete. New total: ${newTotal}`);
}

main()
    .catch(e => console.log(e))
    .finally(() => prisma.$disconnect());
