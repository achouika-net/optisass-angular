const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const factures = await prisma.facture.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
            id: true,
            numero: true,
            type: true,
            fiche: {
                select: {
                    content: true
                }
            }
        }
    });

    factures.forEach(f => {
        console.log(`ID: ${f.id} | Num: ${f.numero} | Type: ${f.type}`);
        if (f.fiche?.content) {
            // Look for any field that looks like a 4-5 digit number (likely old invoice num)
            const keys = Object.keys(f.fiche.content);
            const possibleNums = keys.filter(k => /^\d{4,5}$/.test(String(f.fiche.content[k])) || k.toLowerCase().includes('num'));
            if (possibleNums.length > 0) {
                console.log(`  Possible nums: ${possibleNums.map(k => `${k}=${f.fiche.content[k]}`).join(', ')}`);
            }
        }
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
