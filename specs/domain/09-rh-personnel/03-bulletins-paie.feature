# language: fr
Fonctionnalité: Génération et validation des bulletins de paie
  En tant qu'admin
  Je veux générer et valider les bulletins de paie mensuels
  Afin de rémunérer les employés et enregistrer les dépenses salariales

  Contexte:
    Étant donné que je suis connecté en tant qu'admin
    Et que nous sommes en fin de mois "avril 2026"
    Et que l'employé "Karim Alami" a :
      | Salaire de base        | 4 500 DH |
      | Commissions du mois    | 1 240 DH |
      | Heures supplémentaires | 8h x 45 DH = 360 DH |
      | Primes                 | 0 DH     |
      | Retenues               | 450 DH   |

  Scénario: Générer automatiquement un bulletin de paie en PROJET
    Quand je clique sur "Générer les bulletins" pour le mois "avril 2026"
    Alors un bulletin est créé pour "Karim Alami" avec le statut "PROJET"
    Et le montant net calculé est "5 650 DH" (4500 + 1240 + 360 - 450)
    Et les commissions intégrées ont le statut "VALIDÉE" automatiquement

  Scénario: Valider un bulletin de paie
    Étant donné qu'un bulletin de "Karim Alami" est au statut "PROJET"
    Quand je clique sur "Valider" sur ce bulletin
    Alors le bulletin passe au statut "VALIDÉE"
    Et le bouton "Marquer comme payé" devient disponible

  Scénario: Enregistrer automatiquement la dépense salariale à la validation du paiement
    Étant donné qu'un bulletin de "Karim Alami" est au statut "VALIDÉE" avec un montant de "5 650 DH"
    Quand je clique sur "Marquer comme payé"
    Alors le bulletin passe au statut "PAYÉE"
    Et une dépense de type "SALAIRE" de "5 650 DH" est créée automatiquement en comptabilité
    Et le compte comptable "6125 — Salaires" est crédité
    Et les commissions du mois passent au statut "PAYÉE"

  Scénario: Refuser un bulletin avec montant net négatif
    Étant donné que les retenues d'un employé dépassent son salaire + commissions
    Quand le système tente de générer le bulletin
    Alors le bulletin n'est pas créé
    Et une alerte "Montant net négatif détecté — vérifier les retenues" s'affiche à l'admin

  Scénario: Refuser des retenues supérieures au salaire + commissions
    Quand je tente de saisir des retenues de "7 000 DH" pour un employé avec "5 000 DH" de salaire + commissions
    Alors le formulaire affiche l'erreur "Les retenues ne peuvent pas dépasser le salaire de base + commissions"

  Scénario: Générer le PDF du bulletin après validation
    Étant donné qu'un bulletin est au statut "VALIDÉE" ou "PAYÉE"
    Quand je clique sur "Télécharger le bulletin"
    Alors un PDF est généré avec les informations de l'employé, la période, le détail des éléments de paie et le montant net

  Scénario: Consolider les commissions multi-centre dans le bulletin
    Étant donné que "Karim Alami" a des commissions sur "Casa Maarif" (800 DH) et "Casa Ain Diab" (440 DH)
    Quand le bulletin d'avril 2026 est généré
    Alors le total commissions dans le bulletin est "1 240 DH"
    Et le détail par centre est visible dans le bulletin

  Scénario: Intégrer les heures supplémentaires issues du pointage
    Étant donné que le système de pointage a calculé "8 heures supplémentaires" pour "Karim Alami" en avril
    Et que son taux horaire est "45 DH"
    Quand le bulletin est généré
    Alors les heures supplémentaires de "360 DH" sont intégrées automatiquement avec la source "POINTAGE"

  Scénario: Corriger les heures supplémentaires manuellement
    Étant donné qu'un bulletin est au statut "PROJET"
    Quand l'admin modifie les heures supplémentaires à "10h" manuellement
    Alors le montant est recalculé à "450 DH" (10h x 45 DH)
    Et la source est marquée "SAISIE_MANUELLE"
    Et le montant net est recalculé automatiquement
