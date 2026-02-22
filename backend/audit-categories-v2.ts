import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    const factures = await prisma.facture.findMany({
        where: { centreId },
        select: {
            type: true,
            statut: true,
            totalTTC: true,
            numero: true,
            dateEmission: true
        }
    });

    const summary = {} as any;
    for (const f of factures) {
        const key = `${f.type || 'UNKNOWN'} | ${f.statut || 'UNKNOWN'}`;
        if (!summary[key]) summary[key] = { count: 0, total: 0 };
        summary[key].count++;
        summary[key].total += (f.totalTTC || 0);
    }

    console.log('--- Summary per Type|Statut for Center ---');
    console.log(JSON.stringify(summary, null, 2));

    // Find documents that are FACTURE type but VENTE_EN_INSTANCE status
    const instanceFactures = factures.filter(f =>
        (f.type === 'FACTURE' || (f.numero && f.numero.startsWith('FAC'))) &&
        f.statut === 'VENTE_EN_INSTANCE'
    );

    if (instanceFactures.length > 0) {
        console.log('\n--- Factures in VENTE_EN_INSTANCE status ---');
        console.log('Count:', instanceFactures.length);
        const sum = instanceFactures.reduce((s, x) => s + (x.totalTTC || 0), 0);
        console.log('Total TTC:', sum);
    }

    await prisma.$disconnect();
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
