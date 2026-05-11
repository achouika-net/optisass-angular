const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public'
    }
  }
});

// Import the service from dist
const { CommissionService } = require('./dist/features/personnel/commission.service');

async function main() {
  try {
    console.log('Starting recalculation for 2026-05...');
    const service = new CommissionService(prisma);
    const result = await service.recalculateForPeriod('2026-05');
    console.log('Recalculation result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error during recalculation:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
