import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration for payment types...');

  const updateCheques = await prisma.echeancePaiement.updateMany({
    where: {
      type: {
        in: ['CHÈQUE', 'CHÉQUE', 'Chèque', 'Chéque', 'cheque', 'CHQUE']
      }
    },
    data: {
      type: 'CHEQUE'
    }
  });
  console.log('Updated ' + updateCheques.count + ' records to CHEQUE.');

  const updateVirement = await prisma.echeancePaiement.updateMany({
    where: {
      type: {
        in: ['PRÉLÈVEMENT', 'PRELEVEMENT', 'Prélèvement', 'Prélévement', 'prelevement', 'PRLVEMENT']
      }
    },
    data: {
      type: 'VIREMENT'
    }
  });
  console.log('Updated ' + updateVirement.count + ' records to VIREMENT.');

  console.log('Migration completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
