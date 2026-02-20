
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function mergeDuplicateClients() {
    console.log('🚀 Starting Client Merge Cleanup...');

    const allClients = await prisma.client.findMany({
        include: {
            _count: {
                select: {
                    fiches: true,
                    factures: true
                }
            }
        }
    });

    console.log(`📊 Found ${allClients.length} total clients.`);

    // Group by Case-Insensitive Name
    const groups = new Map<string, any[]>();

    for (const client of allClients) {
        const key = (client.nom || '').trim().toLowerCase();
        if (!key || key.includes('inconnu') || key.includes('auto-')) continue;

        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(client);
    }

    let mergedCount = 0;

    for (const [name, clients] of groups.entries()) {
        if (clients.length < 2) continue;

        // Pick primary candidate: the one with the most records, or the oldest
        const sorted = [...clients].sort((a, b) => {
            const aCount = (a._count.fiches + a._count.factures);
            const bCount = (b._count.fiches + b._count.factures);
            if (bCount !== aCount) return bCount - aCount;
            return a.dateCreation.getTime() - b.dateCreation.getTime();
        });

        const primary = sorted[0];
        const duplicates = sorted.slice(1);

        console.log(`🔍 Merging duplicate group: "${name}" (${clients.length} records) -> Keeping ${primary.id} (F:${primary._count.fiches}, FAC:${primary._count.factures})`);

        for (const dup of duplicates) {
            try {
                await prisma.$transaction(async (tx) => {
                    // 1. Move Fiches
                    await tx.fiche.updateMany({
                        where: { clientId: dup.id },
                        data: { clientId: primary.id }
                    });

                    // 2. Move Factures
                    await tx.facture.updateMany({
                        where: { clientId: dup.id },
                        data: { clientId: primary.id }
                    });

                    // 3. Move FactureFournisseur (if any)
                    await tx.factureFournisseur.updateMany({
                        where: { clientId: dup.id },
                        data: { clientId: primary.id }
                    });

                    // 4. Move PointsHistory
                    await tx.pointsHistory.updateMany({
                        where: { clientId: dup.id },
                        data: { clientId: primary.id }
                    });

                    // 5. Move MouvementStock
                    await tx.mouvementStock.updateMany({
                        where: { clientId: dup.id },
                        data: { clientId: primary.id }
                    });

                    // 6. Delete the duplicate client
                    await tx.client.delete({ where: { id: dup.id } });
                });
                mergedCount++;
            } catch (err) {
                console.error(`❌ Error merging client ${dup.id} into ${primary.id}:`, err.message);
            }
        }
    }

    console.log(`✅ Cleanup finished. Merged/Deleted ${mergedCount} duplicate clients.`);
}

mergeDuplicateClients()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
