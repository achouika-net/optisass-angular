
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const total = await prisma.echeancePaiement.count();
    const payee = await prisma.echeancePaiement.count({ where: { statut: 'PAYEE' } });
    const enAttente = await prisma.echeancePaiement.count({ where: { statut: 'EN_ATTENTE' } });

    console.log('--- RECAP ECHEANCES ---');
    console.log(`Total: ${total}`);
    console.log(`PAYEE: ${payee}`);
    console.log(`EN_ATTENTE: ${enAttente}`);
    console.log('-----------------------');

    const samplePayee = await prisma.echeancePaiement.findMany({
        where: { statut: 'PAYEE' },
        take: 5,
        select: { id: true, montant: true, reference: true, remarque: true, createdAt: true }
    });
    console.log('Sample PAYEE:', samplePayee);
}

main();
