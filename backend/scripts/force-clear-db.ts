import { Client } from 'pg';

async function main() {
    const client = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'optisaas',
        password: 'admin', // Mot de passe original du .env local
        port: 5432, // Port original du .env local
    });

    try {
        await client.connect();
        console.log('Connecté à la base de données PostgreSQL.');

        console.log('Suppression en cours...');

        // TRUNCATE CASCADE supprime toutes les données des tables spécifiées et de leurs dépendants
        await client.query(`
      TRUNCATE TABLE 
        "Depense", 
        "FactureFournisseur", 
        "EcheancePaiement", 
        "BonLivraison", 
        "MouvementStock", 
        "OperationCaisse", 
        "DemandeAlimentation" 
      CASCADE;
    `);

        console.log('✅ Toutes les tables financières (Factures, BL, Dépenses, Echeances...) ont été vidées avec succès.');
    } catch (err) {
        console.error('Erreur lors de la connexion ou de la suppression :', err);
    } finally {
        await client.end();
    }
}

main();
