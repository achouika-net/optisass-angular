import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const brands = await prisma.glassBrand.findMany();
  const materials = await prisma.glassMaterial.findMany({ include: { indices: true } });
  const treatments = await prisma.glassTreatment.findMany();

  console.log('Brands:', brands.length);
  console.log('Materials:', materials.length);
  console.log('Treatments:', treatments.length);
  
  if (brands.length > 0) console.log('Sample Brand:', brands[0]);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
