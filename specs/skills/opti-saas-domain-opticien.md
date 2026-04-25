# opti-saas-domain-opticien — PO Virtuel
# Consulter avant toute décision de design ou d'implémentation métier
# v1.0.0 — 2026-04-25 — Modules 09 et 10 couverts

## HARD LIMITS (ne jamais contredire)
- Création compte utilisateur MANUELLE — jamais automatique à la création d'un employé
- Commissions validées AUTOMATIQUEMENT (CALCULÉE -> VALIDÉE sans intervention humaine)
- Taux de commission configurables au niveau GROUPE — pas par centre individuellement
- Toutes fonctions peuvent vendre (VENDEUR, CAISSIER, OPTICIEN, MANAGER)
- Salaire de base CONSTANT sur tous les centres pour un employé multi-centre
- Écran de sélection de centre à CHAQUE connexion — pas de mémorisation
- 2FA configuré UNE SEULE FOIS à l'activation — jamais redemandé au login quotidien
- Données utilisateur désactivé conservées À VIE — jamais supprimées
- Désactivation employé -> désactivation compte AUTOMATIQUE et IMMÉDIATE

## MODULE 09 — RH & PERSONNEL
Référence horaire : 44h/semaine (droit marocain)
Salaire minimum : 2500 DH (SMIC marocain)
Types contrats : CDI | CDD | ANAPEC | Stagiaire | Freelance (extensible)
Compte comptable salaires : 6125
Solde congés : 1.5 jour/mois, plafond 18 jours, report en fin d'année (plafonné 18j)
Approbation congés : MANAGER (pas l'admin)
Congés légaux : CONGE_ANNUEL | MALADIE | MATERNITE | PATERNITE | SANS_SOLDE | EXCEPTIONNEL | ABSENCE_INJUSTIFIEE
Retenue absence : (Salaire base / Jours ouvrables du mois) x Jours absents non payés

## MODULE 10 — AUTH & UTILISATEURS
Token JWT durée : 8 heures
Inactivité session : 30 minutes
Rôles : ADMIN (groupe entier) | MANAGER | VENDEUR | CAISSIER | VIEWER
ADMIN périmètre : tous les centres du groupe sans exception
Blocage : 5 tentatives -> 15 min (auto) ou immédiat par admin
Permissions (11) : peutValiderFactures | peutModifierPrix | peutVoirComptabilite | peutGererEmployes | peutAccederCaisse | peutVoirRapports | peutGererStock | peutGererFournisseurs | peutAccederRH | peutAnnulerFacture | peutAppliquerRemise
peutAnnulerFacture : ADMIN uniquement (action critique)
