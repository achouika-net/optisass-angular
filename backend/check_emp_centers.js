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
    const emp = await prisma.employee.findUnique({
      where: { id: empId },
      include: { 
        centres: { include: { centre: true } }
      }
    });
    
    if (!emp) {
      console.log('Employee not found');
      return;
    }

    console.log(`Employee: ${emp.nom} ${emp.prenom}`);
    console.log('Centres linked:', JSON.stringify(emp.centres, null, 2));

    if (emp.centres.length === 0) {
      console.log('CRITICAL: Employee has NO linked centers!');
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
