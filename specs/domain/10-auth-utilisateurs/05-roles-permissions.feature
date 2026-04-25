# language: fr
Fonctionnalité: Rôles et permissions granulaires
  En tant qu'admin
  Je veux attribuer des rôles et permissions par centre
  Afin de contrôler finement les accès

  Contexte:
    Étant donné que les 5 rôles sont : ADMIN, MANAGER, VENDEUR, CAISSIER, VIEWER
    Et que l'ADMIN est global au groupe (tous les centres)

  Plan du scénario: Permissions par défaut selon le rôle
    Étant donné qu'un utilisateur a le rôle "<role>" sur un centre
    Alors la permission "<permission>" est "<etat>" par défaut
    Exemples:
      | role     | permission          | etat     |
      | ADMIN    | peutValiderFactures | active   |
      | ADMIN    | peutAnnulerFacture  | active   |
      | MANAGER  | peutValiderFactures | active   |
      | MANAGER  | peutAnnulerFacture  | inactive |
      | VENDEUR  | peutValiderFactures | inactive |
      | CAISSIER | peutAccederCaisse   | active   |
      | VIEWER   | peutVoirRapports    | active   |

  Scénario: Activer une permission granulaire pour un vendeur spécifique
    Étant donné que "Karim Alami" a le rôle "VENDEUR" sur "Casa Maarif"
    Quand l'admin active "peutAppliquerRemise" pour "Karim Alami" sur "Casa Maarif"
    Alors "Karim Alami" peut appliquer des remises sur "Casa Maarif"
    Et cette permission ne s'applique pas sur ses autres centres

  Scénario: L'admin a accès à tous les centres du groupe
    Étant donné que "Youssef Mrani" a le rôle "ADMIN"
    Quand il se connecte
    Alors il peut accéder aux données de tous les centres sans restriction

  Scénario: Annuler une facture payée - permission réservée à l'admin
    Étant donné qu'un manager tente d'annuler une facture payée
    Alors l'action est refusée avec le message "Permission insuffisante"
    Et un log d'audit est enregistré
