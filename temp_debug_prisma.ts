
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const centreId = "456f5be0-9f01-4ea1-8d55-f17a82e85ef8";

    console.log('Testing query for FactureFournisseur with indirect centreId filtering...');

    try {
        const invoices = await prisma.factureFournisseur.findMany({
            where: {
                OR: [
                    { depense: { centreId: centreId } },
                    { echeances: { some: { depense: { centreId: centreId } } } }
                ]
            },
            include: {
                fournisseur: { select: { nom: true } }
            },
            orderBy: { dateEmission: 'desc' },
            take: 5
        });

        console.log('Success! Found', invoices.length, 'invoices.');
    } catch (error) {
        console.error('Query failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
