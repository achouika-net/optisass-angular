# language: fr
Fonctionnalité: Gestion des employés
  En tant qu'admin
  Je veux créer et gérer les fiches employés
  Afin de maintenir un registre RH complet et lié au système utilisateur

  Contexte:
    Étant donné que je suis connecté en tant qu'admin global
    Et que je suis sur la page "RH & Personnel"

  Scénario: Créer une fiche employé avec tous les champs obligatoires
    Quand je clique sur "Nouvel employé"
    Et je saisis le nom complet "Mehdi Tahiri"
    Et je saisis le CIN "BE456789"
    Et je sélectionne la fonction "VENDEUR"
    Et je saisis le salaire de base "4500"
    Et je sélectionne le type de contrat "CDI"
    Et je saisis la date de début de contrat "2026-01-15"
    Et j'affecte l'employé au centre "Casa Maarif"
    Et je clique sur "Enregistrer"
    Alors la fiche employé est créée avec le statut "ACTIF"
    Et un message de confirmation s'affiche "Employé créé avec succès"
    Et aucun compte utilisateur n'est créé automatiquement

  Scénario: Empêcher un salaire de base inférieur au SMIC marocain
    Quand je crée une fiche employé avec le salaire de base "2000"
    Alors le formulaire affiche l'erreur "Le salaire de base doit être supérieur ou égal à 2 500 DH (SMIC marocain)"
    Et la fiche n'est pas enregistrée

  Scénario: Créer un employé multi-centre avec salaire constant
    Quand je crée une fiche employé avec le salaire de base "5000"
    Et j'affecte l'employé aux centres "Casa Maarif" et "Casa Ain Diab"
    Et je clique sur "Enregistrer"
    Alors l'employé apparaît dans la liste des deux centres
    Et le salaire de base affiché est "5 000 DH" sur chaque centre

  Scénario: Tous les postes peuvent avoir des commissions
    Quand je crée une fiche employé avec la fonction "OPTICIEN"
    Et je configure un taux de commission global de "3"
    Et je clique sur "Enregistrer"
    Alors la règle de commission est bien enregistrée pour cet opticien
    Et le système ne bloque pas la configuration de commission pour cette fonction

  Scénario: Désactiver un employé désactive son compte utilisateur automatiquement
    Étant donné qu'un employé "Sara Benali" a un compte utilisateur actif lié
    Quand je clique sur "Désactiver" sur la fiche de "Sara Benali"
    Et je confirme la désactivation
    Alors la fiche employé passe au statut "DÉSACTIVÉ"
    Et le compte utilisateur lié passe automatiquement au statut "DÉSACTIVÉ"
    Et toutes les sessions actives de "Sara Benali" sont invalidées immédiatement

  Scénario: Modifier une fiche employé existante
    Étant donné qu'un employé "Karim Alami" existe avec le salaire "4500"
    Quand je clique sur "Modifier" sur la fiche de "Karim Alami"
    Et je modifie le salaire de base à "5000"
    Et je clique sur "Enregistrer"
    Alors le salaire de base est mis à jour à "5 000 DH"
    Et la modification est horodatée dans l'historique

  Scénario: Refuser un type de contrat invalide
    Quand je tente de saisir le type de contrat "INTERIM"
    Alors le système propose la liste des types disponibles : CDI, CDD, ANAPEC, Stagiaire, Freelance
    Et me permet d'ajouter un nouveau type si nécessaire

  Scénario: Valider le format du CIN
    Quand je saisis le CIN "123" dans la fiche employé
    Alors le formulaire affiche l'erreur "Format de CIN invalide"
    Et la fiche n'est pas enregistrée

  Scénario: Valider l'unicité du CIN dans le système
    Étant donné qu'un employé avec le CIN "BE456789" existe déjà
    Quand je tente de créer un nouvel employé avec le même CIN "BE456789"
    Alors le formulaire affiche l'erreur "Ce CIN est déjà associé à un autre employé"
    Et la fiche n'est pas enregistrée
