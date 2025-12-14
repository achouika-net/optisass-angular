-- AlterTable
ALTER TABLE "Paiement" ADD COLUMN     "banque" TEXT,
ADD COLUMN     "dateVersement" TIMESTAMP(3),
ADD COLUMN     "pieceJointe" TEXT,
ADD COLUMN     "remarque" TEXT,
ADD COLUMN     "tiersCin" TEXT,
ADD COLUMN     "tiersNom" TEXT;
