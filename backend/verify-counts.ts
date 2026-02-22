import { PrismaClient } from '@prisma/client';

async function verifyFinalCounts() {
    const prisma = new PrismaClient();
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    console.log('=== VERIFICATION: Vente avec/sans facture ===\n');

    // Tab 3: Factures = DEVIS + FACTURE types (vente avec facture)
    const facturesCount = await prisma.facture.count({
        where: {
            centreId,
            type: { not: 'AVOIR' },
            statut: { notIn: ['VENTE_EN_INSTANCE', 'ANNULEE', 'ARCHIVE'] },
            OR: [
                { numero: { startsWith: 'FAC' } },
                { type: 'FACTURE' },
                { type: 'DEVIS' }
            ]
        }
    });

    // Tab 1: BCs = BON_COMMANDE type (vente sans facture)
    const bcCount = await prisma.facture.count({
        where: {
            centreId,
            type: { in: ['BON_COMMANDE', 'BON_COMM'] },
            statut: { notIn: ['ARCHIVE', 'ANNULEE'] }
        }
    });

    const totalCount = await prisma.facture.count({ where: { centreId } });

    console.log(`Tab 3 - Factures (vente avec facture): ${facturesCount}`);
    console.log(`  Expected: ~2,843`);
    console.log(`\nTab 1 - Bons de Commande (vente sans facture): ${bcCount}`);
    console.log(`  Expected: ~10,389`);
    console.log(`\nTotal records in DB for this centre: ${totalCount}`);
    console.log(`Sum of Tabs 1+3: ${facturesCount + bcCount}`);

    await prisma.$disconnect();
}

verifyFinalCounts();
