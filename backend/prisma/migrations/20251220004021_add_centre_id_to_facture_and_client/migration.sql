-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "centreId" TEXT;

-- AlterTable
ALTER TABLE "Facture" ADD COLUMN     "centreId" TEXT;

-- CreateTable
CREATE TABLE "Groupe" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "adresse" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Groupe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Centre" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "adresse" TEXT,
    "ville" TEXT,
    "codePostal" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "groupeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Centre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entrepot" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "capaciteMax" DOUBLE PRECISION,
    "surface" DOUBLE PRECISION,
    "responsable" TEXT,
    "centreId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entrepot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "codeInterne" TEXT NOT NULL,
    "codeBarres" TEXT NOT NULL,
    "referenceFournisseur" TEXT,
    "designation" TEXT NOT NULL,
    "marque" TEXT,
    "modele" TEXT,
    "couleur" TEXT,
    "typeArticle" TEXT NOT NULL,
    "famille" TEXT,
    "sousFamille" TEXT,
    "fournisseurPrincipal" TEXT,
    "quantiteActuelle" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "seuilAlerte" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prixAchatHT" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "prixVenteHT" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prixVenteTTC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tauxTVA" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "statut" TEXT NOT NULL,
    "photo" TEXT,
    "utilisateurCreation" TEXT NOT NULL,
    "specificData" JSONB,
    "entrepotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouvementStock" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "dateMovement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motif" TEXT NOT NULL,
    "utilisateur" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "entrepotSourceId" TEXT,
    "entrepotDestinationId" TEXT,
    "fournisseurId" TEXT,
    "clientId" TEXT,
    "factureId" TEXT,
    "prixAchatUnitaire" DOUBLE PRECISION,
    "prixVenteUnitaire" DOUBLE PRECISION,
    "numeroLot" TEXT,
    "datePeremption" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MouvementStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "civilite" TEXT NOT NULL,
    "telephone" TEXT,
    "email" TEXT NOT NULL,
    "photoUrl" TEXT,
    "matricule" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCentreRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "centreName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "entrepotIds" TEXT[],
    "entrepotNames" TEXT[],

    CONSTRAINT "UserCentreRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Groupe_nom_key" ON "Groupe"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Centre_groupeId_nom_key" ON "Centre"("groupeId", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "Entrepot_centreId_nom_key" ON "Entrepot"("centreId", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "Product_codeInterne_key" ON "Product"("codeInterne");

-- CreateIndex
CREATE UNIQUE INDEX "Product_codeBarres_key" ON "Product"("codeBarres");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserCentreRole_userId_centreId_key" ON "UserCentreRole"("userId", "centreId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "Centre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "Centre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Centre" ADD CONSTRAINT "Centre_groupeId_fkey" FOREIGN KEY ("groupeId") REFERENCES "Groupe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrepot" ADD CONSTRAINT "Entrepot_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "Centre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_entrepotId_fkey" FOREIGN KEY ("entrepotId") REFERENCES "Entrepot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_entrepotSourceId_fkey" FOREIGN KEY ("entrepotSourceId") REFERENCES "Entrepot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_entrepotDestinationId_fkey" FOREIGN KEY ("entrepotDestinationId") REFERENCES "Entrepot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCentreRole" ADD CONSTRAINT "UserCentreRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
