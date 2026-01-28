const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCommissions() {
    try {
        const rules = await prisma.commissionRule.findMany();
        console.log('--- COMMISSION RULES ---');
        console.log(rules);

        const commissions = await prisma.commission.findMany({
            include: {
                employee: { select: { nom: true, prenom: true, poste: true } },
                facture: { select: { numero: true, totalTTC: true } }
            },
            take: 20
        });
        console.log('\n--- RECENT COMMISSIONS ---');
        console.log(commissions);

        const facturesWithoutVendeur = await prisma.facture.count({
            where: { vendeurId: null, statut: { in: ['VALIDE', 'PAYEE', 'PARTIEL'] } }
        });
        console.log(`\nValidated invoices without vendeurId: ${facturesWithoutVendeur}`);

        const facturesWithVendeur = await prisma.facture.findMany({
            where: { vendeurId: { not: null }, statut: { in: ['VALIDE', 'PAYEE', 'PARTIEL'] } },
            include: { commissions: true },
            take: 10
        });
        console.log('\n--- FACTURES WITH VENDEUR (SAMPLE) ---');
        facturesWithVendeur.forEach(f => {
            console.log(`Facture ${f.numero}: vendeurId=${f.vendeurId}, commissionsCount=${f.commissions.length}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkCommissions();
