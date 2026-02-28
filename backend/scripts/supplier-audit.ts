
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- SUPPLIER & INVOICE MATCHING AUDIT ---');

    // 1. Check for Duplicate Suppliers (Similar names)
    const allSuppliers = await prisma.fournisseur.findMany({ select: { id: true, nom: true, ice: true } });
    const nameCounts = new Map<string, number>();
    allSuppliers.forEach(s => {
        const normalized = s.nom?.trim().toUpperCase();
        if (normalized) nameCounts.set(normalized, (nameCounts.get(normalized) || 0) + 1);
    });

    const dupes = Array.from(nameCounts.entries()).filter(([name, count]) => count > 1);
    console.log(`Found ${dupes.length} potential duplicate supplier names:`, dupes);

    // 2. Check if the 9 extra invoices' numbers exist under other suppliers
    const extras = await prisma.factureFournisseur.findMany({
        where: { referenceInterne: { contains: 'AUTO-CREATED' } }
    });

    console.log(`\nAnalyzing the 9 extra invoices:`);
    for (const f of extras) {
        const others = await prisma.factureFournisseur.findMany({
            where: {
                AND: [
                    { numeroFacture: { equals: f.numeroFacture, mode: 'insensitive' } },
                    { id: { not: f.id } }
                ]
            },
            include: { fournisseur: true }
        });

        if (others.length > 0) {
            console.log(`- Auto-created ${f.numeroFacture} for supplier ${f.fournisseurId}. FOUND IT ALREADY for supplier ${others[0].fournisseur.nom} (${others[0].fournisseur.id})`);
        } else {
            console.log(`- Auto-created ${f.numeroFacture}. Not found elsewhere.`);
        }
    }

    // 3. Check for invoices where number matches but supplier doesn't
    console.log('\n--- GLOBAL CROSS-SUPPLIER MATCH CHECK ---');
    // I skip this for now to keep it simple
}

main().finally(() => prisma.$disconnect());
