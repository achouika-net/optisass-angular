
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
    console.log('Cleaning tables for fresh import...');
    try {
        // Correct model names from schema
        // EcheancePaiement depends on FactureFournisseur (nullable)
        // Depense depends on EcheancePaiement (nullable) and FactureFournisseur

        console.log('Clearing EcheancePaiement...');
        await prisma.echeancePaiement.deleteMany();

        console.log('Clearing Depense...');
        await prisma.depense.deleteMany();

        console.log('Clearing FactureFournisseur...');
        await prisma.factureFournisseur.deleteMany();

        console.log('Tables cleaned successfully.');
    } catch (e) {
        console.error('Error cleaning tables:', e);
    } finally {
        await prisma.$disconnect();
    }
}

clean();
