import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- 🔍 AUDITING PAYMENTS ---');
    const total = await prisma.paiement.count();
    console.log(`Total payments in DB: ${total}`);

    // Detect duplicates based on Facture, Date, Montant and Mode
    const dups: any[] = await prisma.$queryRaw`
        SELECT "factureId", "date", "montant", "mode", COUNT(*) as count
        FROM "Paiement"
        GROUP BY "factureId", "date", "montant", "mode"
        HAVING COUNT(*) > 1
    `;

    console.log(`Found ${dups.length} groups of duplicates.`);

    let deletedCount = 0;
    for (const group of dups) {
        // Keep one, delete the rest
        const payments = await prisma.paiement.findMany({
            where: {
                factureId: group.factureId,
                date: group.date,
                montant: group.montant,
                mode: group.mode
            },
            select: { id: true },
            orderBy: { createdAt: 'asc' }
        });

        const toDelete = payments.slice(1).map(p => p.id);
        if (toDelete.length > 0) {
            await prisma.paiement.deleteMany({
                where: { id: { in: toDelete } }
            });
            deletedCount += toDelete.length;
        }
    }

    console.log(`✅ Deduplication complete. Deleted ${deletedCount} duplicate payments.`);
    console.log(`New total: ${await prisma.paiement.count()}`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
