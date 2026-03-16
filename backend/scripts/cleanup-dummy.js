const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Cleaning up dummy data ---');
    const dummyOps = await prisma.operationCaisse.findMany({
        where: { motif: 'Test Mixed Dashboard' }
    });
    
    for (const op of dummyOps) {
        // Revert session totals
        await prisma.journeeCaisse.update({
            where: { id: op.journeeCaisseId },
            data: {
                totalComptable: { decrement: op.montant },
                totalVentesEspeces: (op.moyenPaiement === 'ESPECES') ? { decrement: op.montant } : undefined,
                totalVentesCarte: (op.moyenPaiement === 'CARTE') ? { decrement: op.montant } : undefined,
            }
        });
        
        await prisma.operationCaisse.delete({ where: { id: op.id } });
        console.log(`Deleted dummy op: ${op.id}`);
    }
}

main().finally(() => prisma.$disconnect());
