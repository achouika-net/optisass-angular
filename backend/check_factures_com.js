const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public'
    }
  }
});

async function main() {
  try {
    const empId = 'fe318ac2-c67e-4b20-8689-4d85e949fd93';
    
    // Check Factures for May 2026 linked to this employee
    const startDate = new Date('2026-05-01');
    const endDate = new Date('2026-05-31');

    const factures = await prisma.facture.findMany({
      where: {
        vendeurId: empId,
        dateEmission: { gte: startDate, lte: endDate }
      }
    });

    console.log(`Found ${factures.length} invoices (Factures) for May 2026 linked to this employee.`);
    
    factures.forEach(f => {
        console.log(`- Facture #${f.numero}: Statut=${f.statut}, TotalTTC=${f.totalTTC}`);
    });

    // Check if there are any commissions already calculated
    const commissions = await prisma.commission.findMany({
        where: { employeeId: empId, mois: '2026-05' }
    });
    console.log(`Total commissions records found for 2026-05: ${commissions.length}`);

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
