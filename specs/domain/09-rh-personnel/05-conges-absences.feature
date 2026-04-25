# language: fr
Fonctionnalité: Gestion des congés et absences
  En tant qu'employé et manager
  Je veux soumettre et approuver les demandes de congé
  Afin de gérer le planning et l'impact sur les bulletins de paie

  Contexte:
    Étant donné que le solde s'acquiert à "1.5 jour par mois complet travaillé"
    Et que le plafond maximum est "18 jours à tout moment"
    Et que les jours non pris en fin d'année sont reportés (plafonnés à 18 jours)
    Et que l'approbation des congés est de la responsabilité du "MANAGER"

  Scénario: Acquérir des jours de congé progressivement
    Étant donné que "Karim Alami" a été embauché le "01 janvier 2026"
    Quand 3 mois complets sont écoulés (janvier, février, mars)
    Alors son solde de congés est "4.5 jours"

  Scénario: Respecter le plafond de 18 jours
    Étant donné que "Karim Alami" a un solde de "17 jours" au 1er novembre
    Quand le mois de novembre est complet
    Alors son solde passe à "18 jours" (17 + 1.5 = 18.5 plafonné à 18)
    Et le système affiche "Plafond atteint — les jours supplémentaires sont perdus"

  Scénario: Reporter les jours non pris en fin d'année
    Étant donné que "Karim Alami" a un solde de "10 jours" au 31 décembre 2026
    Quand l'année 2027 commence
    Alors son solde au 1er janvier 2027 est "10 jours" (jours reportés)
    Et il continue d'acquérir 1.5 jour/mois en 2027 jusqu'au plafond de 18 jours

  Scénario: Soumettre une demande de congé annuel payé
    Étant donné que "Karim Alami" a un solde de "8 jours"
    Quand il soumet une demande de "CONGE_ANNUEL" du "15 mai" au "19 mai 2026" (5 jours ouvrables)
    Alors la demande est créée avec le statut "EN_ATTENTE"
    Et le manager reçoit une notification pour approbation

  Scénario: Manager approuve une demande de congé
    Étant donné qu'une demande de congé de "Karim Alami" est "EN_ATTENTE"
    Quand le manager clique sur "Approuver"
    Alors la demande passe au statut "APPROUVE"
    Et le solde de congés de "Karim Alami" est débité de "5 jours"
    Et le solde restant est "3 jours"

  Scénario: Manager refuse une demande de congé
    Étant donné qu'une demande de congé est "EN_ATTENTE"
    Quand le manager clique sur "Refuser" avec la note "Période chargée"
    Alors la demande passe au statut "REFUSE"
    Et le solde de congés n'est pas modifié
    Et l'employé est notifié du refus avec la raison

  Scénario: Refuser une demande si le solde est insuffisant
    Étant donné que "Karim Alami" a un solde de "2 jours"
    Quand il soumet une demande de "CONGE_ANNUEL" de "5 jours"
    Alors le système affiche l'erreur "Solde insuffisant : 2 jours disponibles, 5 demandés"
    Et la demande n'est pas soumise

  Scénario: Impact congé annuel payé sur le bulletin - aucune retenue
    Étant donné qu'une demande de "CONGE_ANNUEL" de "5 jours" est approuvée en mai 2026
    Quand le bulletin de mai 2026 est généré
    Alors aucune retenue n'est appliquée pour ces jours de congé
    Et le salaire de base est maintenu à "4 500 DH"

  Scénario: Impact absence injustifiée sur le bulletin - retenue prorata
    Étant donné que "Karim Alami" a "2 jours d'absence injustifiée" en avril 2026
    Et que le mois d'avril compte "22 jours ouvrables"
    Quand le bulletin d'avril 2026 est généré
    Alors une retenue de "409 DH" est appliquée (4500 / 22 x 2)
    Et le type d'absence "ABSENCE_INJUSTIFIEE" est noté dans le bulletin

  Scénario: Impact congé sans solde sur le bulletin - retenue prorata
    Étant donné qu'un congé "SANS_SOLDE" de "3 jours" est approuvé pour avril 2026
    Et que le mois d'avril compte "22 jours ouvrables"
    Quand le bulletin d'avril 2026 est généré
    Alors une retenue de "614 DH" est appliquée (4500 / 22 x 3)

  Scénario: Congé maternité - maintien salaire complet sans retenue
    Étant donné qu'une employée soumet un congé "MATERNITE" de "98 jours"
    Quand le congé est approuvé
    Alors aucune retenue n'est appliquée pendant les 98 jours
    Et le salaire est maintenu complet (pris en charge CNSS)

  Plan du scénario: Durées légales des congés exceptionnels
    Étant donné qu'un employé soumet un congé "EXCEPTIONNEL" de type "<motif>"
    Alors la durée maximale légale est "<duree>" jours ouvrables
    Exemples:
      | motif     | duree |
      | mariage   | 4     |
      | deces     | 3     |
      | naissance | 3     |
