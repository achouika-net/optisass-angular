const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function run() {
    const fs = await p.fiche.findMany({ take: 5, select: { numero: true, content: true } });
    fs.forEach(f => {
        const content = typeof f.content === 'string' ? JSON.parse(f.content) : f.content;
        console.log(`NUMERO DB: ${f.numero} | COMPTEUR JSON: ${content.Compteur}`);
    });
    await p.$disconnect();
}
run();
