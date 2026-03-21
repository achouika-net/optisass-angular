const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function test() {
  const prisma = new PrismaClient();
  const factures = await prisma.facture.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  const res = factures.map(f => ({
    id: f.id,
    numero: f.numero,
    type: f.type,
    statut: f.statut,
    proprietes: f.proprietes
  }));
  
  // Write securely bypassing powershell console output encoding issues
  fs.writeFileSync('c:/Users/ASUS/.gemini/antigravity/playground/golden-cluster/backend/points-json.json', JSON.stringify(res, null, 2));
  await prisma.$disconnect();
}

test().catch(e => console.error(e));
