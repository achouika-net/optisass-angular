# language: fr
Fonctionnalité: Connexion et déconnexion
  En tant qu'utilisateur
  Je veux me connecter et déconnecter de manière sécurisée
  Afin d'accéder uniquement aux données de mon centre actif

  Scénario: Connexion réussie mono-centre
    Étant donné que "k.alami@opticentre.ma" est affecté uniquement à "Casa Maarif"
    Quand je saisis l'email et le mot de passe correct
    Alors je suis redirigé directement vers le tableau de bord de "Casa Maarif"
    Et un token JWT de 8 heures est généré

  Scénario: Connexion réussie avec sélection de centre (multi-centre)
    Étant donné que "k.alami@opticentre.ma" est affecté à "Casa Maarif" et "Casa Ain Diab"
    Quand je saisis l'email et le mot de passe corrects
    Alors l'écran de sélection de centre s'affiche avec les deux centres disponibles
    Quand je sélectionne "Casa Maarif"
    Alors je suis redirigé vers le tableau de bord de "Casa Maarif"
    Et le token JWT contient "centreActifId: Casa Maarif"

  Scénario: L'écran de sélection de centre s'affiche à chaque connexion
    Étant donné que j'ai sélectionné "Casa Maarif" lors de ma dernière connexion
    Quand je me reconnecte le lendemain
    Alors l'écran de sélection de centre s'affiche à nouveau
    Et aucun centre n'est pré-sélectionné par défaut

  Scénario: Message d'erreur générique pour credentials invalides
    Quand je saisis l'email "inconnu@test.ma" avec n'importe quel mot de passe
    Alors le message "Email ou mot de passe incorrect" s'affiche
    Et le système ne confirme pas l'existence de l'email

  Scénario: Déconnexion manuelle
    Étant donné que je suis connecté
    Quand je clique sur "Déconnexion"
    Alors mon token JWT est invalidé côté serveur
    Et je suis redirigé vers la page de connexion

  Scénario: Déconnexion automatique après 8 heures
    Étant donné que je me suis connecté il y a "8 heures"
    Quand j'effectue une action dans l'application
    Alors le système m'affiche "Session expirée — veuillez vous reconnecter"

  Scénario: Déconnexion automatique après 30 minutes d'inactivité
    Étant donné que je n'ai effectué aucune action depuis "30 minutes"
    Quand je tente d'accéder à une page protégée
    Alors le système m'affiche "Session expirée — veuillez vous reconnecter"

  Scénario: Connexion refusée pour un compte suspendu
    Étant donné que le compte "n.haddad@opticentre.ma" est au statut "SUSPENDU"
    Quand je tente de me connecter avec les bons credentials
    Alors le message "Compte suspendu, contactez votre administrateur" s'affiche

  Scénario: Connexion refusée pour un compte désactivé
    Étant donné que le compte "r.amrani@opticentre.ma" est au statut "DÉSACTIVÉ"
    Quand je tente de me connecter avec les bons credentials
    Alors le message "Compte désactivé, contactez votre administrateur" s'affiche
