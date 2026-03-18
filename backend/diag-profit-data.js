
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- DIAGNOSTIC: Invoice Date Distribution ---');
  
  const range = await prisma.facture.aggregate({
    where: {
      statut: { notIn: ['ARCHIVE'] },
      type: { in: ['FACTURE', 'BON_COMMANDE', 'AVOIR', 'DEVIS'] },
    },
    _min: { dateEmission: true },
    _max: { dateEmission: true },
    _count: { id: true },
    _sum: { totalTTC: true }
  });
  
  console.log('Overall Facture Range:', range);

  const months = await prisma.$queryRaw`
    SELECT 
      DATE_TRUNC('month', "dateEmission") as month,
      COUNT(*) as count,
      SUM("totalTTC") as revenue
    FROM "Facture"
    WHERE "statut" NOT IN ('ARCHIVE')
      AND "type" IN ('FACTURE', 'BON_COMMANDE', 'AVOIR', 'DEVIS')
    GROUP BY 1
    ORDER BY 1
  `;
  
  console.log('Monthly Breakdown:', months);
  
  const depenses = await prisma.depense.aggregate({
    _min: { date: true },
    _max: { date: true },
    _sum: { montant: true }
  });
  console.log('Depense Summary:', depenses);
}

main().catch(console.error).finally(() => prisma.$disconnect());
