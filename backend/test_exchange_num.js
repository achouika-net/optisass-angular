const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getPrefix(type) {
    switch (type) {
        case 'FACTURE': return 'FAC';
        case 'AVOIR': return 'AVR';
        default: return 'DOC';
    }
}

async function generateNextNumber(type, tx) {
    const year = new Date().getFullYear();
    const prefix = await getPrefix(type);
    const client = tx || prisma;

    const lastDoc = await client.facture.findFirst({
        where: {
            numero: {
                startsWith: `${prefix} -${year} `
            }
        },
        orderBy: {
            numero: 'desc'
        }
    });

    let sequence = 1;
    if (lastDoc) {
        const parts = lastDoc.numero.split('-');
        if (parts.length === 3) {
            sequence = parseInt(parts[2]) + 1;
        }
    }

    return `${prefix} -${year} -${sequence.toString().padStart(3, '0')} `;
}

async function main() {
    console.log('--- Exchange Numbering Collision Test ---');

    try {
        await prisma.$transaction(async (tx) => {
            const nextFAC = await generateNextNumber('FACTURE', tx);
            console.log(`Generated FAC in TX: "${nextFAC}"`);

            // Simulating update from FacturesService logic
            const nextAVR = await generateNextNumber('AVOIR', tx);
            console.log(`Generated AVR in TX: "${nextAVR}"`);

            // Check if these numbers exist
            const facExists = await tx.facture.findUnique({ where: { numero: nextFAC } });
            const avrExists = await tx.facture.findUnique({ where: { numero: nextAVR } });

            console.log(`FAC Exists in DB? ${!!facExists}`);
            console.log(`AVR Exists in DB? ${!!avrExists}`);
        });
    } catch (e) {
        console.error('Test Failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
