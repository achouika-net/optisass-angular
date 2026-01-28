const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMismatch() {
    try {
        const rules = await prisma.commissionRule.findMany();
        console.log('--- COMMISSION RULES ---');
        rules.forEach(r => console.log(`Rule: poste=${r.poste}, typeProduit=${r.typeProduit}, taux=${r.taux}%`));

        const invoices = await prisma.facture.findMany({
            where: { vendeurId: { not: null }, statut: { in: ['VALIDE', 'PAYEE', 'PARTIEL'] } },
            take: 5
        });

        for (const f of invoices) {
            console.log(`\n--- Facture: ${f.numero} (vendeurId: ${f.vendeurId}) ---`);
            const lines = typeof f.lignes === 'string' ? JSON.parse(f.lignes) : f.lignes;

            for (const line of lines) {
                if (line.productId) {
                    const product = await prisma.product.findUnique({ where: { id: line.productId } });
                    if (product) {
                        console.log(`Line Item: ${line.description}`);
                        console.log(`Product TypeArticle: ${product.typeArticle}`);

                        // Check if any rule matches
                        const match = rules.find(r => r.typeProduit.toUpperCase() === product.typeArticle.toUpperCase());
                        if (match) {
                            console.log(`✅ MATCHED RULE: ${match.typeProduit}`);
                        } else {
                            const globalMatch = rules.find(r => r.typeProduit === 'GLOBAL');
                            if (globalMatch) {
                                console.log(`ℹ️ MATCHED GLOBAL RULE`);
                            } else {
                                console.log(`❌ NO MATCHING RULE FOUND`);
                            }
                        }
                    } else {
                        console.log(`Product ${line.productId} not found for line ${line.description}`);
                    }
                } else {
                    console.log(`Custom Line: ${line.description}`);
                }
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkMismatch();
