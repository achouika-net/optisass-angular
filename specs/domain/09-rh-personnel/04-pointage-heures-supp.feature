# language: fr
Fonctionnalité: Pointage et heures supplémentaires
  En tant que système et manager
  Je veux enregistrer les heures de travail et calculer les heures supplémentaires
  Afin d'alimenter automatiquement les bulletins de paie

  Contexte:
    Étant donné que la référence contractuelle est "44 heures par semaine" (droit marocain)
    Et que le taux horaire supplémentaire de "Karim Alami" est "45 DH/heure"

  Scénario: Enregistrer une entrée et sortie de pointage
    Étant donné que "Karim Alami" est sur le centre "Casa Maarif" le "2026-04-15"
    Quand le système enregistre l'heure d'entrée "08h30" et l'heure de sortie "18h45"
    Alors la durée travaillée est calculée à "10h15"
    Et le pointage est enregistré avec la source "POINTAGE"

  Scénario: Calculer automatiquement les heures supplémentaires hebdomadaires
    Étant donné que "Karim Alami" a travaillé "50 heures" sur la semaine du 14 au 18 avril 2026
    Alors le système calcule "6 heures supplémentaires" (50 - 44)
    Et ces heures sont reportées dans son bilan mensuel

  Scénario: Saisir les heures supplémentaires manuellement
    Étant donné qu'un manager est sur la fiche de "Karim Alami"
    Quand il saisit manuellement "8 heures supplémentaires" pour avril 2026
    Et il enregistre
    Alors les heures sont enregistrées avec la source "SAISIE_MANUELLE"
    Et elles sont intégrées au bulletin de paie d'avril 2026

  Scénario: Priorité du pointage sur la saisie manuelle
    Étant donné que le système de pointage a calculé "6 heures supplémentaires" pour avril
    Et qu'une saisie manuelle de "8 heures" a également été effectuée
    Alors le système utilise par défaut les données de pointage "6 heures"
    Et la saisie manuelle est conservée comme correction possible par l'admin

  Scénario: Calculer le montant des heures supplémentaires
    Étant donné que "Karim Alami" a "8 heures supplémentaires" en avril 2026
    Et que son taux horaire est "45 DH/heure"
    Alors le montant des heures supplémentaires est "360 DH"
    Et ce montant est intégré dans le bulletin de paie

  Scénario: Afficher le récapitulatif de pointage mensuel
    Quand je consulte le pointage de "Karim Alami" pour "avril 2026"
    Alors je vois la liste des jours travaillés avec heures d'entrée et de sortie
    Et le total d'heures travaillées du mois
    Et le total d'heures supplémentaires calculées
