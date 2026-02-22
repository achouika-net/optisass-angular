import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';
    const start = new Date('2000-01-01T00:00:00.000Z');
    const end = new Date('2026-02-21T23:59:59.999Z');

    const allDocs = await prisma.facture.findMany({
        where: {
            centreId,
            statut: { notIn: ['ANNULEE', 'ARCHIVE'] }
        },
        select: {
            id: true,
            numero: true,
            type: true,
            statut: true,
            totalTTC: true,
            dateEmission: true
        }
    });

    const filterFactures = (f: any) => {
        return ((f.numero || '').startsWith('FAC') || f.type === 'FACTURE') &&
            !['VENTE_EN_INSTANCE', 'ANNULEE', 'ARCHIVE'].includes(f.statut) &&
            f.type !== 'AVOIR';
    };

    const filterBCs = (f: any) => {
        return (f.statut === 'VENTE_EN_INSTANCE') ||
            (f.type === 'BON_COMMANDE' || f.type === 'BON_COMM' || (f.numero || '').startsWith('BC'));
    };

    let dashboardFacturesTotal = 0;
    let dashboardBCsTotal = 0;
    // Added type annotation to fix TS never error
    let lostFactures: any[] = [];

    for (const f of allDocs) {
        const inRange = f.dateEmission && f.dateEmission >= start && f.dateEmission <= end;
        if (filterFactures(f)) {
            if (inRange) {
                dashboardFacturesTotal += f.totalTTC;
            } else {
                lostFactures.push(f);
            }
        }
        if (filterBCs(f) && inRange) {
            dashboardBCsTotal += f.totalTTC;
        }
    }

    console.log('Dashboard Factures Total (Estimated):', dashboardFacturesTotal);
    console.log('Dashboard BCs Total (Estimated):', dashboardBCsTotal);
    console.log('Number of lost factures due to date:', lostFactures.length);

    if (lostFactures.length > 0) {
        console.log('Sample lost factures:', lostFactures.slice(0, 5));
        const totalLost = lostFactures.reduce((s, x) => s + x.totalTTC, 0);
        console.log('Total lost Amount:', totalLost);
    }

    await prisma.$disconnect();
}

run();