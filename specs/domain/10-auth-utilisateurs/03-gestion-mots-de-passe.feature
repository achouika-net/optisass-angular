# language: fr
Fonctionnalité: Gestion des mots de passe
  En tant qu'utilisateur
  Je veux gérer mon mot de passe de manière sécurisée
  Afin de protéger mon accès au système

  Scénario: Accepter un mot de passe conforme
    Quand je saisis le mot de passe "MonPass1!"
    Alors le mot de passe est accepté

  Plan du scénario: Rejeter un mot de passe non conforme
    Quand je saisis le mot de passe "<mdp>"
    Alors le message d'erreur "<erreur>" s'affiche
    Exemples:
      | mdp      | erreur |
      | abc      | Minimum 8 caractères requis |
      | abcdefgh | Au moins 1 majuscule requise |
      | ABCDEFGH | Au moins 1 minuscule requise |
      | Abcdefgh | Au moins 1 chiffre requis |

  Scénario: Bloquer la réutilisation des 3 derniers mots de passe
    Étant donné que mes 3 derniers mots de passe étaient "Pass1!", "Pass2!" et "Pass3!"
    Quand je tente de changer mon mot de passe pour "Pass1!"
    Alors le message "Ce mot de passe a déjà été utilisé récemment" s'affiche

  Scénario: Bloquer le compte après 5 tentatives échouées
    Étant donné que j'ai saisi un mauvais mot de passe "4 fois"
    Quand je saisis un mauvais mot de passe une "5ème fois"
    Alors le compte est bloqué
    Et le message "Trop de tentatives — réessayez dans 15 minutes" s'affiche

  Scénario: Déblocage automatique après 15 minutes
    Étant donné que le compte est bloqué depuis "15 minutes"
    Quand je tente de me connecter à nouveau
    Alors le compte est automatiquement débloqué

  Scénario: Déblocage immédiat par l'admin
    Étant donné que le compte de "k.alami@opticentre.ma" est bloqué
    Quand l'admin clique sur "Débloquer le compte"
    Alors le compte est débloqué immédiatement

  Scénario: Réinitialiser le mot de passe via email
    Quand je clique sur "Mot de passe oublié"
    Et je saisis mon email "k.alami@opticentre.ma"
    Alors un email de réinitialisation est envoyé valable "24 heures"

  Scénario: Rejeter un lien de réinitialisation expiré
    Étant donné que je clique sur un lien reçu "il y a plus de 24 heures"
    Alors le message "Ce lien a expiré" s'affiche
