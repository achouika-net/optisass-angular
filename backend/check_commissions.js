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
    const emp = await prisma.employee.findUnique({ where: { id: empId } });
    console.log(`Checking commissions for: ${emp.nom} ${emp.prenom} (Poste: ${emp.poste})`);

    const rules = await prisma.commissionRule.findMany({
      where: { poste: emp.poste }
    });
    console.log('Commission Rules for this poste:', JSON.stringify(rules, null, 2));

    // Check sales for this month (May 2026) linked to this employee
    const startDate = new Date('2026-05-01');
    const endDate = new Date('2026-05-31');

    const fiches = await prisma.fiche.findMany({
      where: {
        vendeurId: empId,
        date: { gte: startDate, lte: endDate },
        statut: { not: 'ANNULE' }
      },
      include: {
        lignesFiche: true
      }
    });

    console.log(`Found ${fiches.length} sales (fiches) for May 2026 linked to this employee.`);
    
    if (fiches.length > 0) {
        console.log('First sale details:', JSON.stringify(fiches[0].lignesFiche, null, 2));
    }

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
