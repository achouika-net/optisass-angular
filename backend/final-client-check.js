const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const factures = await prisma.facture.findMany({
        where: {
            client: {
                nom: 'CHAFIAI',
                prenom: 'NADIA'
            }
        },
        select: {
            id: true,
            numero: true,
            type: true,
            statut: true,
            fiche: {
                select: {
                    id: true,
                    content: true
                }
            },
            createdAt: true
        }
    });

    console.log('--- FACTURES FOR CHAFIAI NADIA ---');
    factures.forEach(f => {
        console.log(`[${f.numero}] Type: ${f.type} | Created: ${f.createdAt.toISOString()}`);
        // Dump all numeric fields in content
        if (f.fiche && f.fiche.content) {
            const content = f.fiche.content;
            const numericEntries = Object.entries(content).filter(([k, v]) => !isNaN(Number(v)) && String(v).length > 2);
            if (numericEntries.length > 0) {
                console.log(`  Numeric Content: ${JSON.stringify(Object.fromEntries(numericEntries))}`);
            }
            // Look for string fields that might be the original ID
            const possibleIds = Object.entries(content).filter(([k, v]) => String(v).includes('/') || k.toLowerCase().includes('id'));
            if (possibleIds.length > 0) {
                console.log(`  Possible IDs: ${JSON.stringify(Object.fromEntries(possibleIds))}`);
            }
        }
        console.log('---');
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
