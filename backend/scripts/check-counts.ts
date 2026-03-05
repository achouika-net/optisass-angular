import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();

    console.log('📊 --- DATABASE AUDIT --- 📊');

    // 1. Basic Counts
    const counts = {
        clients: await prisma.client.count(),
        fiches: await prisma.fiche.count(),
        factures: await prisma.facture.count(),
        products: await prisma.product.count(),
        paiements: await prisma.paiement.count(),
        entrepot: await prisma.entrepot.count(),
    };
    console.log('Counts:', counts);

    // 2. Facture breakdown (Type & Status)
    const factureBreaks = await prisma.facture.groupBy({
        by: ['type', 'statut'],
        _count: { _all: true },
        _sum: { totalTTC: true }
    });
    console.log('\nFacture Breakdown (Type/Status):');
    factureBreaks.forEach(b => {
        console.log(` - ${b.type} / ${b.statut}: ${b._count._all} records, Sum: ${b._sum.totalTTC}`);
    });

    // 3. Date check
    const dateRange = await prisma.facture.aggregate({
        _min: { dateEmission: true },
        _max: { dateEmission: true }
    });
    console.log('\nFacture Date Emission Range:', dateRange);

    // 4. Products check (since stock is 0)
    if (counts.products > 0) {
        const prodSample = await prisma.product.findFirst();
        console.log('\nProduct Sample:', prodSample);
    } else {
        console.log('\n⚠️ NO PRODUCTS FOUND IN DATABASE');
    }

    // 5. Check if some factures have NO lines (lignes JSON empty array)
    // Prisma filter for empty JSON is tricky, let's just do a sample
    const sampleNoLines = await prisma.facture.findMany({
        take: 5,
        orderBy: { dateEmission: 'desc' },
        select: { id: true, numero: true, type: true, lignes: true }
    });
    console.log('\nSample Recent Factures Lignes:', sampleNoLines.map(f => ({
        id: f.id,
        num: f.numero,
        type: f.type,
        lineCount: Array.isArray(f.lignes) ? f.lignes.length : 'NOT ARRAY'
    })));

    await prisma.$disconnect();
}

main();
