
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Centres ---');
    const centres = await prisma.centre.findMany();
    centres.forEach(c => console.log(`${c.nom}: ${c.id}`));

    console.log('\n--- Produits Ray-Ban (Toutes centres) ---');
    const rb = await prisma.product.findMany({
        where: {
            designation: { contains: 'Ray-Ban', mode: 'insensitive' }
        },
        include: {
            entrepot: {
                include: { centre: true }
            }
        }
    });
    rb.forEach(p => {
        console.log(`[${p.statut}] [Code: ${p.codeInterne}] ${p.designation} - Stock: ${p.quantiteActuelle} - Centre: ${p.entrepot?.centre?.nom}`);
        if (p.specificData) {
            console.log(`  SpecificData: ${JSON.stringify(p.specificData)}`);
        }
    });

    console.log('\n--- Produits en Transit / Réservés ---');
    const tr = await prisma.product.findMany({
        where: {
            statut: { in: ['RESERVE', 'EN_TRANSIT', 'reserve', 'en_transit'] }
        },
        include: {
            entrepot: {
                include: { centre: true }
            }
        }
    });
    tr.forEach(p => {
        console.log(`[${p.statut}] [Code: ${p.codeInterne}] ${p.designation} - Centre: ${p.entrepot?.centre?.nom}`);
        console.log(`  SpecificData: ${JSON.stringify(p.specificData)}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
