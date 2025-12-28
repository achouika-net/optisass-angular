
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugFull() {
    try {
        console.log('--- DOCUMENTS ---');
        const docs = await prisma.facture.findMany({
            where: {
                numero: { contains: '1766745497205' }
            },
            include: { paiements: true }
        });
        console.log(`Found ${docs.length} documents.`);
        docs.forEach(d => {
            console.log(`[${d.id}] ${d.numero} (${d.type}/${d.statut}) - TTC: ${d.totalTTC}, Reste: ${d.resteAPayer}`);
            console.log(`   Paiements: ${d.paiements.length}`);
        });

        console.log('\n--- PAIEMENTS 500 DH (Recent) ---');
        const paiements = await prisma.paiement.findMany({
            where: {
                montant: 500
            },
            orderBy: { date: 'desc' },
            take: 5,
            include: { facture: true }
        });
        console.log(`Found ${paiements.length} recent payments of 500 DH.`);
        paiements.forEach(p => {
            console.log(`[${p.id}] ${p.date.toISOString()} -> Facture: ${p.facture?.numero} (${p.facture?.id})`);
        });

    } catch (e) { console.error(e); }
    finally { await prisma.$disconnect(); }
}

debugFull();
