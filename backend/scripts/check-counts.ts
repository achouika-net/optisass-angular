import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    const tables = [
        'Client',
        'Fiche',
        'Facture',
        'FactureFournisseur',
        'Paiement',
        'Groupe',
        'Fournisseur',
        'MouvementStock'
    ];

    console.log('📊 Current Database Counts:');
    for (const table of tables) {
        try {
            const count = await (prisma as any)[table.toLowerCase()].count();
            console.log(`${table}: ${count}`);
        } catch (e) {
            console.log(`${table}: Error - ${e.message}`);
        }
    }
    await prisma.$disconnect();
}

main();
