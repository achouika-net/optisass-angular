# language: fr
Fonctionnalité: Isolation des données multi-centre
  En tant que système
  Je veux garantir qu'un utilisateur ne voit que les données de son centre actif
  Afin de protéger la confidentialité des données

  Scénario: Un utilisateur ne voit que les données de son centre actif
    Étant donné que "Karim Alami" est connecté sur "Casa Maarif"
    Quand il consulte la liste des clients
    Alors seuls les clients du centre "Casa Maarif" sont affichés

  Scénario: Refuser l'accès direct aux données d'un autre centre via l'URL
    Étant donné que "Karim Alami" est connecté sur "Casa Maarif"
    Quand il tente d'accéder à "/api/centres/casa-ain-diab/factures"
    Alors le système retourne une erreur "403 Forbidden"
    Et un log d'audit est enregistré

  Scénario: L'admin global voit toutes les données
    Étant donné que "Youssef Mrani" a le rôle "ADMIN"
    Quand il accède à n'importe quel centre
    Alors l'isolation multi-centre ne s'applique pas à son compte

  Scénario: Changer de centre change l'isolation active
    Étant donné que "Karim Alami" est connecté sur "Casa Maarif"
    Quand il se reconnecte en sélectionnant "Casa Ain Diab"
    Alors son token JWT est renouvelé avec "centreActifId: Casa Ain Diab"
    Et il ne voit plus les données de "Casa Maarif"

  Scénario: Données d'un utilisateur désactivé accessibles aux admins
    Étant donné que le compte de "r.amrani@opticentre.ma" est désactivé
    Quand l'admin consulte les factures créées par cet utilisateur
    Alors les factures sont visibles en lecture seule dans les rapports
