const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Numbering Logic Verification ---');

    const prefix = 'FAC';
    const year = 2026;
    const startsWith = `${prefix} -${year} `;

    // Test Old Logic (with type filter)
    const lastDocOld = await prisma.facture.findFirst({
        where: {
            type: 'FACTURE',
            numero: { startsWith: startsWith }
        },
        orderBy: { numero: 'desc' }
    });
    console.log(`Old Logic (Type: 'FACTURE'): found ${lastDocOld ? lastDocOld.numero : 'NONE'}`);

    // Test New Logic (NO type filter)
    const lastDocNew = await prisma.facture.findFirst({
        where: {
            numero: { startsWith: startsWith }
        },
        orderBy: { numero: 'desc' }
    });
    console.log(`New Logic (No type filter): found ${lastDocNew ? lastDocNew.numero : 'NONE'}`);

    if (lastDocNew) {
        const parts = lastDocNew.numero.split('-');
        const sequence = parseInt(parts[2]) + 1;
        const nextNum = `${prefix} -${year} -${sequence.toString().padStart(3, '0')} `;
        console.log(`Next generated number will be: "${nextNum}"`);
    }

    await prisma.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
