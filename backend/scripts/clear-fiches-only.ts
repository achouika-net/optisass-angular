import { PrismaClient } from '@prisma/client';
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Clearing Fiche table + orphaned import Factures (IMP-/FAC- prefixed)...');

    try {
        // 1. Delete Factures created by import (numero starts with IMP- or FAC-)
        // These are the ones that may have duplicate numero conflicts on re-import
        try {
            const deletedFactures = await prisma.$executeRaw`
                DELETE FROM "Facture" 
                WHERE "numero" LIKE 'IMP-%' OR "numero" LIKE 'FAC-%'
            `;
            console.log(`✅ Deleted import Factures (IMP-/FAC- prefix). Count:`, deletedFactures);
        } catch (e) {
            console.error('❌ Failed to delete import Factures:', e);
        }

        // 2. Nullify ficheId in remaining Factures
        try {
            const count = await prisma.$executeRaw`UPDATE "Facture" SET "ficheId" = NULL WHERE "ficheId" IS NOT NULL`;
            console.log(`✅ Nullified ficheId in remaining Factures. Result:`, count);
        } catch (e) {
            console.error('❌ Failed to update Facture:', e);
        }

        // 3. Nullify ficheId in FactureFournisseur
        try {
            const count2 = await prisma.$executeRaw`UPDATE "FactureFournisseur" SET "ficheId" = NULL WHERE "ficheId" IS NOT NULL`;
            console.log(`✅ Nullified ficheId in FactureFournisseurs. Result:`, count2);
        } catch (e) {
            console.error('❌ Failed to update FactureFournisseur:', e);
        }

        // 4. Delete all Fiches
        const deletedFiches = await prisma.fiche.deleteMany({});
        console.log(`✅ Deleted ${deletedFiches.count} Fiches.`);

        console.log('\n✨ Ready for fresh import.');
    } catch (error) {
        console.error('❌ Error during clearing:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
