const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const allBc = await prisma.facture.findMany({
        where: { numero: { contains: 'BC' } },
        select: { numero: true }
    });

    const sortedBc = allBc.map(f => {
        const parts = f.numero.split('-');
        const last = parseInt(parts[parts.length - 1]);
        return { numero: f.numero, seq: isNaN(last) ? 0 : last };
    }).sort((a, b) => b.seq - a.seq);

    console.log('Highest BC numbers:', sortedBc.slice(0, 10));

    const allFact = await prisma.facture.findMany({
        where: { numero: { contains: 'Fact' } },
        select: { numero: true }
    });

    const sortedFact = allFact.map(f => {
        const parts = f.numero.split('-');
        const last = parseInt(parts[parts.length - 1]);
        return { numero: f.numero, seq: isNaN(last) ? 0 : last };
    }).sort((a, b) => b.seq - a.seq);

    console.log('Highest Fact numbers:', sortedFact.slice(0, 10));
}

main().catch(console.error).finally(() => prisma.$disconnect());
