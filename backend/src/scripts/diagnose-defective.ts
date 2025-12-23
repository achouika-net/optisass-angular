
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Diagnosing Defective Products Locations...');

    // 1. Find all warehouses with "défectueux" in name
    const warehouses = await prisma.entrepot.findMany({
        where: {
            nom: { contains: 'défectueux', mode: 'insensitive' }
        },
        include: {
            centre: true,
            _count: {
                select: { produits: true }
            }
        }
    });

    console.log(`\n🏭 Found ${warehouses.length} Defective Warehouses:`);
    warehouses.forEach(w => {
        console.log(`- [${w.id}] "${w.nom}" (Type: ${w.type}) | Centre: ${w.centre?.nom || 'NONE'} (${w.centreId}) | Products: ${w._count.produits}`);
    });

    // 2. Find all products with "Défectueux" in designation
    const products = await prisma.product.findMany({
        where: {
            designation: { contains: 'Défectueux' }
        },
        include: {
            entrepot: {
                include: { centre: true }
            }
        }
    });

    console.log(`\n📦 Found ${products.length} Defective Products:`);
    products.forEach(p => {
        console.log(`- [${p.id}] "${p.designation}" | Stock: ${p.quantiteActuelle} | Status: ${p.statut}`);
        console.log(`  -> Located in Warehouse: [${p.entrepotId}] "${p.entrepot?.nom}" (Centre: ${p.entrepot?.centre?.nom || 'NONE'})`);
    });

    // 3. Find movements to defective warehouses
    const movements = await prisma.mouvementStock.findMany({
        where: {
            type: 'ENTREE_RETOUR_CLIENT',
            entrepotDestination: {
                nom: { contains: 'défectueux', mode: 'insensitive' }
            }
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            entrepotDestination: true,
            produit: true
        }
    });

    console.log(`\n🚚 Last 5 Returns to Defective Storage:`);
    movements.forEach(m => {
        console.log(`- [${m.createdAt.toISOString()}] Product "${m.produit?.designation}" -> Warehouse "${m.entrepotDestination?.nom}" [${m.entrepotDestinationId}]`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
