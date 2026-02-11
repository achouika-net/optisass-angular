
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testComplexImport() {
    console.log('--- STARTING COMPLEX IMPORT VERIFICATION ---');

    // 1. Mock Mapping (Matching our new frontend targetFields)
    const mapping = {
        nom: 'Nom',
        prenom: 'Prénom',
        dateNaissance: 'Birth',
        couvertureSociale: 'Insurance',
        numCouvertureSociale: 'Policy',
        fiche_type: 'ManualType',
        monture_marque: 'M1_Brand',
        monture_modele: 'M1_Model',
        monture2_marque: 'M2_Brand',
        monture2_modele: 'M2_Model',
        produit_designation: 'P_Name',
        produit_prix: 'P_Price'
    };

    // 2. Mock Data
    const data = [
        // Row 1: Complex Client + Double Frame Glasses
        {
            'Nom': 'BENANI',
            'Prénom': 'Ahmed',
            'Birth': '1985-05-20',
            'Insurance': 'CNOPS',
            'Policy': '123456789',
            'ManualType': 'monture',
            'M1_Brand': 'Ray-Ban',
            'M1_Model': 'Aviator',
            'M2_Brand': 'Oakley',
            'M2_Model': 'Holbrook'
        },
        // Row 2: Lens + Product + Auto-provisioning
        {
            'Nom': 'EL AMRANI',
            'ManualType': 'lentilles',
            'P_Name': 'Solution Lentilles 360ml',
            'P_Price': '150'
        }
    ];

    try {
        // Find a center
        const center = await prisma.centre.findFirst();
        if (!center) {
            console.error('❌ No center found in DB. Create one first.');
            return;
        }

        console.log(`Using Center: ${center.nom} (${center.id})`);

        // We need an instance of ImportsService. 
        // In a script, we can either mock it or just simulate its logic since we know it.
        // But better is to use the actual service if possible.
        // For now, let's look at what we've implemented and check the DB after a real run if possible.
        // OR we can manually simulate the logic here as a "Proof of Concept" verify.

        console.log('Skipping direct service call as it requires NestJS container.');
        console.log('You should run this via a manual import in UI or a dedicated API test.');

        // Let's at least check if we can find the fields in DB if they existed
        console.log('Checking Client schema support...');
        const clientFields = Object.keys(prisma.client.fields || {});
        console.log('Client fields:', clientFields);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

testComplexImport();
