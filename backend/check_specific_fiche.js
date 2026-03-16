require('dotenv').config({ path: '../.env' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find the recent invoice
    const facture = await prisma.facture.findFirst({
        where: { numero: 'Fact-2026-004' },
    });

    if (!facture) {
        console.log('Invoice Fact-2026-004 not found');
        return;
    }

    console.log('Invoice found:', facture.id, '| FicheID:', facture.ficheId);

    if (facture.ficheId) {
        const fiche = await prisma.fiche.findUnique({
            where: { id: facture.ficheId }
        });
        if (fiche) {
            console.log('\n=== Fiche Detail ===');
            console.log('ID:', fiche.id);
            console.log('Type:', fiche.type);
            console.log('Statut:', fiche.statut);
            console.log('Content:', JSON.stringify(fiche.content, null, 2));
        } else {
            console.log('Fiche not found for ID:', facture.ficheId);
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
