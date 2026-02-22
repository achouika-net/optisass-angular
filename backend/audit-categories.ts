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

    const summary: any = {};
    for (const f of factures) {
        // Fixed the invalid character/string syntax error
        const key = `${f.type}|${f.statut}`;
        if (!summary[key]) {
            summary[key] = { count: 0, total: 0 };
        }
        summary[key].count++;
        summary[key].total += (f.totalTTC || 0);
    }

    console.log('--- Summary per Type|Statut for Center ---');
    console.log(JSON.stringify(summary, null, 2));

    const nullDates = factures.filter(f =>
        !f.dateEmission && (f.type === 'FACTURE' || (f.numero && f.numero.startsWith('FAC')))
    );

    if (nullDates.length > 0) {
        console.log('Found Factures with NULL dates:', nullDates.length);
        const sumNull = nullDates.reduce((s, x) => s + (x.totalTTC || 0), 0);
        console.log('Total TTC of Factures with NULL dates:', sumNull);
    } else {
        console.log('✅ No Factures with NULL dates found.');
    }

    await prisma.$disconnect();
}

run();