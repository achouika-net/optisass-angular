# language: fr
Fonctionnalité: Gestion des comptes utilisateurs
  En tant qu'admin
  Je veux créer, modifier et désactiver les comptes utilisateurs
  Afin de contrôler les accès au système

  Contexte:
    Étant donné que je suis connecté en tant qu'admin global

  Scénario: Créer un compte utilisateur avec email d'invitation automatique
    Quand je crée un utilisateur avec l'email "m.tahiri@opticentre.ma"
    Et j'affecte l'utilisateur au centre "Casa Maarif" avec le rôle "VENDEUR"
    Et je clique sur "Créer et envoyer l'invitation"
    Alors le compte est créé avec le statut "ACTIF"
    Et un email d'invitation est envoyé automatiquement

  Scénario: Valider l'unicité de l'email
    Étant donné qu'un utilisateur avec l'email "k.alami@opticentre.ma" existe déjà
    Quand je tente de créer un utilisateur avec le même email
    Alors le message "Cet email est déjà utilisé" s'affiche

  Scénario: Affecter un utilisateur à plusieurs centres avec des rôles différents
    Quand je crée un utilisateur et j'affecte :
      | Centre        | Rôle    |
      | Casa Maarif   | Vendeur |
      | Casa Ain Diab | Caissier|
    Alors l'utilisateur a le rôle "VENDEUR" sur "Casa Maarif"
    Et le rôle "CAISSIER" sur "Casa Ain Diab"

  Scénario: Exiger au moins un centre affecté à la création
    Quand je tente de créer un utilisateur sans affecter aucun centre
    Alors le message "Au moins un centre doit être affecté" s'affiche

  Scénario: Désactiver un compte et conserver les données à vie
    Étant donné que "r.amrani@opticentre.ma" a des factures et commissions associées
    Quand je désactive le compte
    Alors le compte passe au statut "DÉSACTIVÉ"
    Et toutes les données historiques sont conservées à vie

  Scénario: Désactivation automatique du compte lors de la désactivation de l'employé lié
    Étant donné que le compte de "k.alami@opticentre.ma" est lié à l'employé "Karim Alami"
    Quand l'admin désactive la fiche employé de "Karim Alami"
    Alors le compte utilisateur est désactivé automatiquement
    Et toutes les sessions actives sont invalidées immédiatement
