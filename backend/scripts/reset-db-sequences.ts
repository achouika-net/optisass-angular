
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Database Sequences Reset...');

    const tables = [
        'Paiement',
        'EcheancePaiement',
        'Facture',
        'FactureFournisseur',
        'Depense',
        'MouvementStock',
        'Fiche',
        'Client',
        'Fournisseur',
        'Product',
        'Entrepot'
    ];

    console.log('⚠️ Truncating tables and restarting identities...');

    for (const table of tables) {
        try {
            // Use raw query for TRUNCATE with RESTART IDENTITY
            // Note: This specific syntax depends on the DB (Postgres/SQLite).
            // If SQLite, TRUNCATE doesn't exist, use DELETE.
            // If Postgres:
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
            console.log(`✅ Table ${table} reset.`);
        } catch (e) {
            console.warn(`⚠️ Failed to truncate ${table} (might not exist or different DB type): ${e.message}`);
            try {
                await (prisma as any)[table.toLowerCase()].deleteMany();
                console.log(`✅ Table ${table} cleared via deleteMany (sequences NOT reset).`);
            } catch (e2) {
                console.error(`❌ Complete failure for ${table}: ${e2.message}`);
            }
        }
    }

    console.log('✨ Database reset complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
