const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
p.fiche.findMany({
  take: 3,
  orderBy: { dateCreation: 'desc' },
  select: { 
    numero: true, 
    type: true,
    ficheData: true
  }
}).then(r => {
  r.forEach(f => {
    console.log('=== FICHE', f.numero, f.type, '===');
    if (f.ficheData) {
      const data = typeof f.ficheData === 'string' ? JSON.parse(f.ficheData) : f.ficheData;
      console.log('verres:', JSON.stringify(data.verres, null, 2));
    }
  });
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
