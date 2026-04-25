# language: fr
Fonctionnalité: Calcul et gestion des commissions
  En tant que système
  Je veux calculer automatiquement les commissions sur chaque facture payée
  Afin d'alimenter les bulletins de paie sans intervention humaine

  Contexte:
    Étant donné que les taux de commission sont configurés au niveau du groupe :
      | Type article | Taux |
      | MONTURE      | 6 %  |
      | VERRE        | 2.5% |
      | LENTILLE     | 4 %  |
      | ACCESSOIRE   | 2 %  |
      | SERVICE      | 1 %  |
    Et que l'employé "Karim Alami" est VENDEUR avec un taux global de "5 %"

  Scénario: Calculer une commission automatiquement quand une facture est payée
    Étant donné qu'une facture contient une monture à "1 200 DH TTC"
    Quand la facture passe au statut "PAYÉE"
    Alors une commission de "72 DH" est automatiquement créée pour "Karim Alami"
    Et la commission a le statut "CALCULÉE"
    Et la commission est rattachée à la période "2026-04"

  Scénario: Passer automatiquement la commission de CALCULÉE à VALIDÉE
    Étant donné qu'une commission vient d'être créée avec le statut "CALCULÉE"
    Alors le système la passe automatiquement au statut "VALIDÉE"
    Et aucune intervention humaine n'est requise pour cette transition

  Scénario: Priorité des règles spécifiques sur le taux global
    Étant donné qu'une facture contient :
      | Article  | Montant TTC | Type     |
      | Monture  | 1 200 DH    | MONTURE  |
      | Verre    | 800 DH      | VERRE    |
    Quand la facture passe au statut "PAYÉE"
    Alors la commission sur la monture est calculée à "6 %" soit "72 DH"
    Et la commission sur le verre est calculée à "2.5 %" soit "20 DH"
    Et le taux global de "5 %" n'est pas appliqué car des règles spécifiques existent

  Scénario: Appliquer le taux global si aucune règle spécifique n'existe
    Étant donné qu'un article de type "PROMO" n'a pas de règle de commission spécifique
    Quand une facture contenant cet article de "500 DH TTC" est payée
    Alors la commission est calculée avec le taux global de "5 %" soit "25 DH"

  Scénario: Un opticien peut toucher des commissions
    Étant donné que l'employé "Sara Benali" est OPTICIEN avec un taux de commission de "3 %"
    Et qu'une facture impliquant "Sara Benali" est payée avec une monture à "1 000 DH"
    Quand la facture passe au statut "PAYÉE"
    Alors une commission est calculée pour "Sara Benali"
    Et le statut de la commission est "VALIDÉE" automatiquement

  Scénario: Regrouper les commissions par centre pour un employé multi-centre
    Étant donné que "Karim Alami" est affecté aux centres "Casa Maarif" et "Casa Ain Diab"
    Et qu'il a réalisé des ventes sur les deux centres en avril 2026
    Quand je consulte les commissions d'avril 2026 pour "Karim Alami"
    Alors les commissions sont affichées séparément par centre
    Et le total consolidé est la somme des commissions des deux centres

  Scénario: Ne pas calculer de commission si la facture n'est pas payée
    Étant donné qu'une facture est au statut "DEVIS" ou "VALIDÉE" ou "PARTIELLEMENT_PAYÉE"
    Alors aucune commission n'est créée
    Et la commission ne sera créée qu'au passage au statut "PAYÉE"

  Scénario: Passer la commission au statut PAYÉE après intégration au bulletin
    Étant donné que les commissions du mois "2026-04" sont validées automatiquement
    Quand le bulletin de paie d'avril 2026 passe au statut "PAYÉE"
    Alors toutes les commissions de la période "2026-04" passent au statut "PAYÉE"
