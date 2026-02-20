
import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        const facturesCount = await prisma.factureFournisseur.count();
        const echeancesCount = await prisma.echeancePaiement.count();
        const suppliersCount = await prisma.fournisseur.count();

        console.log(`--- DATABASE AUDIT ---`);
        console.log(`Fournisseurs: ${suppliersCount}`);
        console.log(`FactureFournisseur: ${facturesCount}`);
        console.log(`EcheancePaiement: ${echeancesCount}`);

        // Check for orphaned echeances
        const allEcheances = await prisma.echeancePaiement.findMany({
            select: { id: true, factureFournisseurId: true }
        });
        const orphaned = allEcheances.filter(e => !e.factureFournisseurId);
        console.log(`Orphaned EcheancePaiement (null facture ID): ${orphaned.length}`);

        // Check for factures with multiple echeances
        const facturesWithEcheances = await prisma.factureFournisseur.findMany({
            select: {
                id: true,
                numeroFacture: true,
                _count: {
                    select: { echeances: true }
                }
            }
        });

        const multiEcheance = facturesWithEcheances.filter(f => f._count.echeances > 1);
        console.log(`Factures with multiple echeances: ${multiEcheance.length}`);
        if (multiEcheance.length > 0) {
            console.log(`Example: ${multiEcheance[0].numeroFacture} has ${multiEcheance[0]._count.echeances} echeances`);
        }

        // Check for duplicate invoice numbers per supplier
        const allFF = await prisma.factureFournisseur.findMany({
            select: { numeroFacture: true, fournisseurId: true }
        });
        const seen = new Set();
        const dupes: string[] = [];
        for (const f of allFF) {
            const key = `${f.numeroFacture}-${f.fournisseurId}`;
            if (seen.has(key)) dupes.push(key);
            seen.add(key);
        }
        console.log(`Duplicate (numeroFacture, fournisseurId) pairs found: ${dupes.length}`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
