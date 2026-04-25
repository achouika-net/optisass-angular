# language: fr
Fonctionnalité: Authentification à double facteur (2FA)
  En tant qu'utilisateur
  Je veux configurer le 2FA une seule fois à l'activation de mon compte
  Afin de sécuriser mon accès sans friction quotidienne

  Scénario: Configurer le 2FA lors de la première connexion
    Étant donné que je reçois un email d'invitation avec un lien d'activation
    Quand je clique sur le lien d'activation
    Et je choisis mon mot de passe initial
    Alors l'écran de configuration 2FA s'affiche obligatoirement
    Et je dois valider le 2FA avant d'accéder au système

  Scénario: Valider la configuration 2FA avec un code correct
    Étant donné que l'écran de configuration 2FA est affiché
    Quand je saisis le code à 6 chiffres reçu par email ou TOTP
    Et le code est valide (moins de 5 minutes)
    Alors le 2FA est marqué "configuré" sur mon compte
    Et je suis redirigé vers la sélection de centre puis le tableau de bord

  Scénario: Le 2FA n'est pas redemandé lors des connexions suivantes
    Étant donné que mon 2FA est déjà "configuré" sur mon compte
    Quand je me connecte avec email et mot de passe corrects
    Alors aucun écran 2FA ne s'affiche
    Et je suis redirigé directement vers la sélection de centre

  Scénario: Rejeter un code 2FA expiré
    Étant donné que l'écran de configuration 2FA est affiché
    Quand je saisis un code généré il y a "plus de 5 minutes"
    Alors le message "Code expiré — demandez un nouveau code" s'affiche

  Scénario: Permettre de redemander un code 2FA
    Étant donné que le code 2FA est expiré ou non reçu
    Quand je clique sur "Renvoyer le code"
    Alors un nouveau code à 6 chiffres est généré et envoyé
    Et l'ancien code est invalidé immédiatement

  Scénario: Bloquer l'accès si le 2FA n'est pas configuré
    Étant donné qu'un utilisateur n'a pas encore configuré son 2FA
    Quand il tente d'accéder à n'importe quelle page protégée
    Alors il est redirigé vers l'écran de configuration 2FA
    Et il ne peut pas contourner cette étape
