# 🧠 api.adscity.net – Backend Central d’AdsCity

*api.adscity.net* est le cœur logique de la plateforme AdsCity.  
Il fournit toutes les APIs nécessaires au fonctionnement des applications frontales : authentification, gestion des utilisateurs, annonces, paiements, sécurité, et plus encore.

---

## 🚀 Objectif

Fournir une *API REST sécurisée, modulaire et scalable* pour :

- Authentifier et autoriser les utilisateurs (JWT + cookies)
- Gérer les annonces, comptes, boutiques et paiements
- Communiquer avec les services tiers (email, paiement, traduction)
- Offrir des services centralisés aux autres sous-domaines AdsCity

---

## 📦 Technologies utilisées

- *Node.js + Express.js* – Serveur principal
- *Firebase Admin SDK* – Authentification, Firestore, Notifications
- *MongoDB / PostgreSQL* – Base de données des utilisateurs et annonces
- *JWT + Cookies sécurisés* – Authentification inter-domaines
- *CORS* – Gestion fine des accès multi-sous-domaines
- *Cron + Node-cron* – Tâches planifiées (expiration, nettoyage, rappels)
