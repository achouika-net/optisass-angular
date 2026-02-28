const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./src/app.module');
const { ImportsService } = require('./src/features/imports/imports.service');

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const importsService = app.get(ImportsService);

    const testData = [{
        "Numero": "TEST-INV-123",
        "Fournisseur": "Fournisseur Test",
        "Date": "2026-01-01",
        "Montant": "1000"
    }];

    const mapping = {
        numeroFacture: "Numero",
        nomFournisseur: "Fournisseur",
        dateEmission: "Date",
        montantTTC: "Montant"
    };

    console.log("--- STARTING TEST IMPORT ---");
    const result = await importsService.importFacturesFournisseurs(testData, mapping, 'centre-test-id', false);
    console.log("--- TEST IMPORT FINISHED ---", result);

    await app.close();
}

bootstrap().catch(err => {
    console.error(err);
    process.exit(1);
});
