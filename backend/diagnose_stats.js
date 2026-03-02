const { PrismaClient } = require('@prisma/client');

async function debug() {
    const prisma = new PrismaClient();
    const start = new Date('2000-01-01');
    const end = new Date('2030-12-31');

    console.log('--- Checking Revenue Evolution (PostgreSQL) ---');
    try {
        const revenueEvolution = await prisma.$queryRaw`
      SELECT 
        to_char("dateEmission", 'YYYY-MM') as month,
        SUM(CASE 
          WHEN "type" = 'AVOIR' THEN -COALESCE(NULLIF("totalHT", 0), "totalTTC")
          ELSE COALESCE(NULLIF("totalHT", 0), "totalTTC")
        END) as revenue
      FROM "Facture"
      WHERE "dateEmission" BETWEEN ${start} AND ${end}
      AND (
        ("type" IN ('FACTURE', 'BON_COMMANDE') AND "statut" IN ('VALIDE', 'VALIDEE', 'VALIDÉ', 'VALIDÉE', 'PAYEE', 'PAYÉ', 'PAYÉE', 'SOLDEE', 'SOLDÉ', 'SOLDÉE', 'ENCAISSE', 'ENCAISSÉ', 'ENCAISSÉE', 'PARTIEL'))
        OR "type" = 'AVOIR'
      )
      GROUP BY month
      ORDER BY month ASC
    `;
        console.log('Revenue Evolution (first 5):', revenueEvolution.slice(0, 5));
    } catch (e) {
        console.error('Revenue Evolution Error:', e.message);
    }

    console.log('--- Checking FactureFournisseur Raw Data ---');
    const rawPurchases = await prisma.factureFournisseur.findMany({
        take: 10,
        select: { type: true, montantHT: true, dateEmission: true }
    });
    console.log('Sample FactureFournisseur:', rawPurchases);

    const inventoryPurchaseTypes = [
        'ACHAT VERRES OPTIQUES',
        'ACHAT MONTURES OPTIQUES',
        'ACHAT LENTILLES DE CONTACT',
        'ACHAT ACCESSOIRES OPTIQUES',
        'ACHAT_STOCK',
    ];

    const breakdown = await prisma.factureFournisseur.groupBy({
        by: ['type'],
        where: {
            type: { in: inventoryPurchaseTypes }
        },
        _sum: { montantHT: true }
    });
    console.log('COGS Breakdown Result:', breakdown);

    await prisma.$disconnect();
}

debug();
