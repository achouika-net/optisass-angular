const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('🔍 Checking latest 5 imported factures (ANY)...');

    // Loosened filter to catch any recent invoices
    const factures = await prisma.facture.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { fiche: true }
    });

    console.log(`Found ${factures.length} invoices.`);

    for (const f of factures) {
        console.log(`\n📄 Facture ${f.numero} (ID: ${f.id})`);
        console.log(`   Type: ${f.type} | Statut: ${f.statut}`);
        console.log(`   Total TTC: ${f.totalTTC}`);
        console.log(`   Lignes (JSON):`, JSON.stringify(f.lignes));
        console.log(`   Fiche liée: ${f.ficheId ? 'OUI' : 'NON'}`);
        if (f.fiche) {
            let contentStr = '';
            try {
                contentStr = JSON.stringify(f.fiche.content);
            } catch (e) { contentStr = 'Error parsing content'; }
            console.log(`   Contenu Fiche (Aperçu):`, contentStr.substring(0, 200) + '...');
        }
    }
}

check()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
