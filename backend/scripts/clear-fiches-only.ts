import { PrismaClient } from '@prisma/client';
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Clearing ONLY Fiche table (preserving Factures and Clients)...');

    try {
        // 1. Nullify references in Facture
        // 1. Nullify references in Facture (Use Raw SQL to bypass Prisma issues)
        // Note: Table names in Prisma default to PascalCase if mapped, but usually lower case in DB. 
        // Checking schema.prisma: model Facture mapped to "Facture" table? 
        // Default prisma behavior is model name = table name unless @@map is present.
        // Let's assume standard "Facture" table name (case sensitive in quotes for Postgres if needed, or just standard sql)

        try {
            console.log('Attempting to update Facture...');
            const count = await prisma.$executeRaw`UPDATE "Facture" SET "ficheId" = NULL WHERE "ficheId" IS NOT NULL`;
            console.log(`✅ Nullified ficheId in Factures (Raw SQL). Result:`, count);
        } catch (e) {
            console.error('❌ Failed to update Facture:', e);
        }

        // 2. Nullify references in FactureFournisseur
        try {
            console.log('Attempting to update FactureFournisseur...');
            const count2 = await prisma.$executeRaw`UPDATE "FactureFournisseur" SET "ficheId" = NULL WHERE "ficheId" IS NOT NULL`;
            console.log(`✅ Nullified ficheId in FactureFournisseurs (Raw SQL). Result:`, count2);
        } catch (e) {
            console.error('❌ Failed to update FactureFournisseur:', e);
        }

        // 3. Delete all Fiches
        // We use executeRaw to bypass any middleware or to handle potential cascade issues more directly if needed, 
        // but deleteMany is usually fine.
        const deletedFiches = await prisma.fiche.deleteMany({});
        console.log(`✅ Deleted ${deletedFiches.count} Fiches.`);

        console.log('\n✨ Fiche table is now empty.');
    } catch (error) {
        console.error('❌ Error during clearing:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
