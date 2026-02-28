import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const suppliersWithIgnored = ['TEST', 'TOP LENS', 'MULTILENS', 'FOURNISSEUR INCONNU'];

    console.log('--- Unpaid Balances for problem suppliers ---');
    for (const sName of suppliersWithIgnored) {
        const s = await prisma.fournisseur.findFirst({
            where: { nom: { equals: sName, mode: 'insensitive' } }
        });

        if (!s) {
            console.log(`\n[${sName}] - Supplier NOT FOUND in DB at all.`);
            continue;
        }

        const unpaidFactures = await prisma.factureFournisseur.findMany({
            where: { fournisseurId: s.id, statut: { in: ['A_PAYER', 'PARTIELLE'] } },
            select: { numeroFacture: true, montantTTC: true, statut: true }
        });

        const unpaidDepenses = await prisma.depense.findMany({
            where: { fournisseurId: s.id, statut: { in: ['A_PAYER', 'PARTIELLE', 'EN_ATTENTE'] } },
            select: { description: true, montant: true, statut: true }
        });

        console.log(`\n[${sName}] (ID: ${s.id})`);
        console.log(`  Unpaid Factures (${unpaidFactures.length}):`);
        unpaidFactures.forEach(f => console.log(`    - ${f.numeroFacture}: ${f.montantTTC} (${f.statut})`));
        console.log(`  Unpaid Expenses (${unpaidDepenses.length}):`);
        unpaidDepenses.forEach(d => console.log(`    - ${d.description}: ${d.montant} (${d.statut})`));
    }

    process.exit(0);
}

main();
