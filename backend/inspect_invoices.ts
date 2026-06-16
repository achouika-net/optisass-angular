import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const factures = await prisma.facture.findMany({
    select: {
      numero: true,
      type: true,
      totalTTC: true,
      createdAt: true,
    }
  });

  console.log('Total factures in DB: ' + factures.length);

  const prefixMap = new Map();
  for (const f of factures) {
    let prefix = 'OTHER';
    if (f.numero.startsWith('Fact-')) {
      prefix = 'Fact-';
    } else if (f.numero.startsWith('BC-')) {
      prefix = 'BC-';
    } else if (f.numero.startsWith('DEV-')) {
      prefix = 'DEV-';
    }
    const val = prefixMap.get(prefix) || { count: 0, sum: 0 };
    val.count++;
    val.sum += f.totalTTC;
    prefixMap.set(prefix, val);
  }

  console.log('=== Prefix Analysis ===');
  for (const [prefix, val] of prefixMap.entries()) {
    console.log(prefix + ': count = ' + val.count + ', sum = ' + val.sum);
  }
}

main().catch(console.error).finally(() => prisma['']());
