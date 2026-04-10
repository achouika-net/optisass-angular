UPDATE "Paiement" 
SET "dateEncaissement" = "dateVersement", "statut" = 'ENCAISSE' 
WHERE "statut" = 'ENCAISSE' AND "dateEncaissement" >= '2026-04-10';
