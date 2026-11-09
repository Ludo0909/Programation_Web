# WorkFlow

Une plateforme d'échange pour faciliter le contact entre collègues et la planification de rencontres.

**Site en ligne :** [ludo0909.github.io/Programation_Web](https://ludo0909.github.io/Programation_Web/)

## Équipe

- Ludovik Chicoine
- Lou-Ann Pasquier

## Objectifs

Ce projet, réalisé dans le cadre du cours de programmation Web, a pour but de mettre en pratique les bases de la conception d'un site Web : structure HTML, mise en page CSS, interactivité en JavaScript et communication avec un service en ligne (authentification et base de données).

### Notre fonctionnalité principale

Un **calendrier intégré aux conversations** : dans chaque salon, les membres peuvent indiquer leurs disponibilités et leurs rencontres afin de trouver facilement des moments communs.

## Fonctionnalités

- Création de compte, connexion, mot de passe oublié et déconnexion
- Salons de discussion publics avec messages en temps réel
- Messages privés entre deux membres
- Calendrier de salon : ajout de rencontres (vert) et d'indisponibilités (rouge), sur une ou plusieurs journées, avec le nom de la personne qui les a ajoutées
- Accueil : rencontres à venir, nombre de salons, heure et liste de tâches personnelles
- Notifications : pastilles de messages non lus dans le menu
- Liste des membres avec recherche par nom d'utilisateur et accès direct à une discussion privée
- Profil : modification des informations personnelles, du mot de passe et de la photo de profil
- Thème clair ou sombre
- Interface adaptée au mobile : menu flottant et un seul panneau de discussion à la fois sur petit écran

## Technologies

| Rôle | Choix |
| --- | --- |
| Interface | HTML, CSS, JavaScript |
| Mise en page (accueil et messagerie) | Bootstrap 5 |
| Authentification et base de données (incluant le temps réel) | Supabase (PostgreSQL) |
| Bibliothèque côté client | supabase-js |
| Hébergement | GitHub Pages |

Il n'y a pas de serveur à configurer : le navigateur communique directement avec Supabase.

## Structure du projet

```
Programation_Web/
├── index.html              Connexion
├── Création_Compte.html    Création de compte
├── MDP_oublié.html         Mot de passe oublié
├── home.html               Accueil (tableau de bord)
├── messages.html           Salons de discussion et calendrier
├── message_prive.html      Messages privés
├── contacts.html           Liste des membres
├── profil.html             Profil de l'utilisateur
├── parametre.html          Paramètres (thème, déconnexion)
├── css/
│   ├── style.css           Mise en page commune (menu, accueil, messagerie, calendrier)
│   ├── auth.css            Pages de connexion, de création de compte et de mot de passe oublié
│   ├── profil.css          Page profil (aussi utilisée par la page contacts)
│   └── contacts.css        Page contacts
└── js/
    ├── supabase-service.js Client Supabase et services (StorageService, AuthService, ChatDatabase, EventDatabase)
    ├── theme.js            Application du thème et menu flottant mobile
    ├── notifications.js    Pastilles de messages non lus
    ├── script.js           Connexion, création de compte et mot de passe oublié
    ├── app.js              Salons de discussion et calendrier de salon
    ├── dm.js               Messages privés
    ├── contacts.js         Liste des membres
    ├── profil.js           Page profil
    └── calendar.js         Calendrier mensuel (non utilisé pour l'instant)
```

## Architecture



### Fichiers utilisés par chaque page

| Page | CSS | JavaScript |
| --- | --- | --- |
| `index.html` | auth.css | supabase-service.js, script.js |
| `Création_Compte.html` | auth.css | supabase-service.js, script.js |
| `MDP_oublié.html` | auth.css | supabase-service.js, script.js |
| `home.html` | style.css, Bootstrap | theme.js, supabase-service.js, notifications.js, script dans la page |
| `messages.html` | style.css, Bootstrap | theme.js, supabase-service.js, notifications.js, app.js |
| `message_prive.html` | style.css, Bootstrap | theme.js, supabase-service.js, notifications.js, dm.js |
| `contacts.html` | style.css, profil.css, contacts.css | theme.js, supabase-service.js, contacts.js |
| `profil.html` | style.css, profil.css | theme.js, supabase-service.js, script.js, profil.js |
| `parametre.html` | style.css, style dans la page | theme.js, supabase-service.js, script dans la page |

### Ordre de chargement des scripts

La bibliothèque supabase-js doit être chargée avant `supabase-service.js`, qui doit l'être avant les scripts de page. Les scripts `defer` s'exécutent dans l'ordre où ils sont écrits, après la lecture du HTML.

`theme.js` est chargé sans `defer` dans le `<head>` pour appliquer le thème avant le premier affichage. Sinon, le thème clair pourrait apparaître brièvement avant le thème sombre.

### Le thème

- Le choix (`light` ou `dark`) est enregistré dans `localStorage` sous la clé `site-theme`, depuis la page Paramètres.
- `theme.js` ajoute la classe `dark-theme` sur `<html>` quand le thème sombre est choisi.
- Les fichiers CSS redéfinissent les couleurs avec des règles `html.dark-theme ...`.

### Affichage mobile

Sous 768 px de largeur, le menu latéral est remplacé par un **menu flottant** (bouton `+` en bas à droite). Dans la messagerie, la liste des conversations et la conversation ouverte s'affichent une à la fois, avec un bouton « Retour ».

### Gestion des sessions

Chaque page protégée vérifie la session avec `AuthService.getUser()` et redirige vers `index.html` si personne n'est connecté. Elle écoute aussi `AuthService.onSessionChange()` pour rediriger dès que la session se termine.

## Base de données

Tables Supabase utilisées par le site :

| Table | Colonnes principales | Rôle |
| --- | --- | --- |
| `channels` | id, name, created_by | Salons de discussion |
| `messages` | id, channel_id, content, username, created_by, created_at | Messages des salons |
| `direct_messages` | id, sender_id, receiver_id, sender_username, content, created_at | Messages privés |
| `events` | id, channel_id, title, category (`projet` ou `occupe`), start_time, end_time, user_id, username | Calendrier des salons |

Les informations du profil (nom complet, nom d'utilisateur, date de naissance) sont enregistrées dans les métadonnées du compte Supabase (`user_metadata`).

### Sécurité

La clé « publishable » de `supabase-service.js` est visible par tout le monde, c'est normal. La protection des données repose sur la sécurité au niveau des lignes (RLS) de PostgreSQL, à configurer dans Supabase pour chaque table.

Ne jamais mettre la clé secrète (`service_role`) dans le code du navigateur.


