import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seeding...');

    // 1. Create Groupe
    const groupe = await prisma.groupe.upsert({
        where: { nom: 'Groupe OptiSass' },
        update: {},
        create: {
            nom: 'Groupe OptiSass',
            description: 'Groupe de démonstration',
            telephone: '0123456789',
        },
    });

    // 2. Create Centre
    const centre = await prisma.centre.upsert({
        where: { groupeId_nom: { groupeId: groupe.id, nom: 'Centre OptiSass Paris' } },
        update: {},
        create: {
            nom: 'Centre OptiSass Paris',
            ville: 'Paris',
            telephone: '0123456789',
            groupeId: groupe.id,
        },
    });

    // 3. Create Entrepots
    const entrepotPrincipal = await prisma.entrepot.upsert({
        where: { centreId_nom: { centreId: centre.id, nom: 'Entrepôt Principal' } },
        update: {},
        create: {
            nom: 'Entrepôt Principal',
            type: 'PRINCIPAL',
            centreId: centre.id,
        },
    });

    const entrepotSecondaire = await prisma.entrepot.upsert({
        where: { centreId_nom: { centreId: centre.id, nom: 'Entrepôt de Vente' } },
        update: {},
        create: {
            nom: 'Entrepôt de Vente',
            type: 'SECONDAIRE',
            centreId: centre.id,
        },
    });

    // 4. Create Users
    const usersData = [
        {
            email: 'achouika.net@gmail.com',
            nom: 'Achouika',
            prenom: 'User',
            civilite: 'M',
        },
        {
            email: 'admin@optisass.com',
            nom: 'Admin',
            prenom: 'System',
            civilite: 'M',
        },
    ];

    for (const data of usersData) {
        const user = await prisma.user.upsert({
            where: { email: data.email },
            update: {},
            create: {
                ...data,
                statut: 'actif',
            },
        });

        // 5. Link User to Centre with Roles
        await prisma.userCentreRole.upsert({
            where: { userId_centreId: { userId: user.id, centreId: centre.id } },
            update: {
                role: 'Gérant',
                entrepotIds: [entrepotPrincipal.id, entrepotSecondaire.id],
                entrepotNames: [entrepotPrincipal.nom, entrepotSecondaire.nom],
            },
            create: {
                userId: user.id,
                centreId: centre.id,
                centreName: centre.nom,
                role: 'Gérant',
                entrepotIds: [entrepotPrincipal.id, entrepotSecondaire.id],
                entrepotNames: [entrepotPrincipal.nom, entrepotSecondaire.nom],
            },
        });
    }

    console.log('✅ Seeding completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
