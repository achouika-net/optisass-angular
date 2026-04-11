
const { PrismaClient } = require('@prisma/client');
// Use localhost because we are running outside docker
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:mypassword@localhost:5432/optisaas?schema=public"
    }
  }
});

async function audit() {
  const start = new Date('2026-01-01T00:00:00Z');
  const end = new Date('2026-12-31T23:59:59Z');

  const docs = await prisma.facture.findMany({
    where: {
      dateEmission: { gte: start, lte: end },
      statut: { notIn: ['ARCHIVE', 'ANNULEE'] }
    },
    select: {
      id: true,
      numero: true,
      type: true,
      totalHT: true,
      totalTTC: true,
      ficheId: true,
      statut: true
    }
  });

  const summary = {};
  let totalHT = 0;
  let totalTTC = 0;

  console.log('--- AUDIT DOCUMENTS 2026 ---');
  docs.forEach(d => {
    if (!summary[d.type]) summary[d.type] = { count: 0, ht: 0, ttc: 0 };
    summary[d.type].count++;
    summary[d.type].ht += (d.totalHT || 0);
    summary[d.type].ttc += (d.totalTTC || 0);
    
    if (d.type === 'AVOIR') {
        totalHT -= (d.totalHT || 0);
        totalTTC -= (d.totalTTC || 0);
    } else {
        totalHT += (d.totalHT || 0);
        totalTTC += (d.totalTTC || 0);
    }
  });

  console.log(JSON.stringify(summary, null, 2));
  console.log('TOTAL HT NET:', totalHT);
  console.log('TOTAL TTC NET:', totalTTC);
  
  // Check for duplicate Fiches (BC and Facture for same sale)
  const fiches = docs.filter(d => d.ficheId).map(d => d.ficheId);
  const duplicates = fiches.filter((item, index) => fiches.indexOf(item) !== index);
  console.log('DUPLICATE FICHES COUNT:', duplicates.length);

  process.exit(0);
}

audit();
