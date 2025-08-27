# GoldWen App Backend

Backend complet pour l'application de rencontre GoldWen, développé selon les spécifications du cahier des charges.

## 🚀 Architecture

### Services
- **API Principale** : NestJS (TypeScript) - Port 3000
- **Service de Matching** : FastAPI (Python) - Port 8000
- **Base de données** : PostgreSQL
- **Cache** : Redis
- **Documentation** : Swagger/OpenAPI

### Fonctionnalités MVP Implémentées

#### ✅ Authentification & Onboarding
- Inscription/connexion par email/mot de passe
- Authentification sociale (Google, Apple)
- Vérification email et réinitialisation mot de passe
- JWT avec sécurité renforcée

#### ✅ Gestion des Profils
- Profils utilisateur complets avec photos
- Questionnaire de personnalité (10 questions)
- Système de prompts pour descriptions
- Upload et gestion des photos
- Géolocalisation et préférences

#### ✅ Système de Matching
- Algorithme de matching basé sur la personnalité
- Sélection quotidienne limitée (3-5 profils)
- Calcul de compatibilité avancé
- Système de choix mutuel

#### ✅ Chat en Temps Réel
- Conversations avec expiration 24h
- Messages temps réel via WebSockets
- Statuts de lecture et "en train d'écrire"
- Historique des conversations

#### ✅ Système d'Abonnement
- Modèle freemium
- Intégration RevenueCat
- Plan GoldWen Plus (3 choix/jour vs 1)
- Gestion des achats in-app

#### ✅ Notifications
- Notifications push (FCM)
- Alertes sélection quotidienne
- Notifications nouveaux matches/messages
- Paramètres utilisateur

#### ✅ Administration
- Panel admin pour modération
- Gestion des utilisateurs
- Système de signalement
- Statistiques et analytics

## 🛠️ Installation et Démarrage

### Prérequis
- Node.js 18+
- Python 3.11+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optionnel)

### Démarrage Rapide avec Docker

```bash
# Cloner le repository
git clone <repository-url>
cd GoldWen-App-Backend

# Démarrer tous les services
docker-compose up -d

# Vérifier que les services sont démarrés
docker-compose ps
```

Services disponibles :
- **API Principale** : http://localhost:3000/api/v1
- **Service Matching** : http://localhost:8000/api/v1
- **Documentation API** : http://localhost:3000/api/v1/docs
- **PostgreSQL** : localhost:5432
- **Redis** : localhost:6379

### Installation Manuelle

#### 1. API Principale (NestJS)

```bash
cd main-api

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos paramètres

# Démarrer en mode développement
npm run start:dev
```

#### 2. Service de Matching (Python)

```bash
cd matching-service

# Créer un environnement virtuel
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows

# Installer les dépendances
pip install -r requirements.txt

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos paramètres

# Démarrer le service
python main.py
```

#### 3. Base de Données

```bash
# Créer la base de données PostgreSQL
createdb goldwen_db

# Les migrations se font automatiquement au démarrage en mode développement
```

## 📚 Documentation API

### Documentation Complète
Consultez le fichier [API_ROUTES.md](./API_ROUTES.md) pour la documentation complète de toutes les routes.

### Swagger Documentation
- **API Principale** : http://localhost:3000/api/v1/docs
- **Service Matching** : http://localhost:8000/api/v1/docs

### Exemples d'Utilisation

#### Inscription
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

#### Connexion
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

#### Récupérer la sélection quotidienne
```bash
curl -X GET http://localhost:3000/api/v1/matching/daily-selection \
  -H "Authorization: Bearer <your-jwt-token>"
```

## 🏗️ Structure du Projet

```
GoldWen-App-Backend/
├── main-api/                     # API Principale NestJS
│   ├── src/
│   │   ├── modules/              # Modules fonctionnels
│   │   │   ├── auth/            # Authentification
│   │   │   ├── users/           # Gestion utilisateurs
│   │   │   ├── profiles/        # Profils et photos
│   │   │   ├── matching/        # Système de matching
│   │   │   ├── chat/            # Chat temps réel
│   │   │   ├── subscriptions/   # Abonnements
│   │   │   ├── notifications/   # Notifications
│   │   │   └── admin/           # Administration
│   │   ├── database/
│   │   │   ├── entities/        # Entités TypeORM
│   │   │   ├── migrations/      # Migrations DB
│   │   │   └── seeders/         # Données initiales
│   │   ├── common/              # Utilitaires partagés
│   │   └── config/              # Configuration
│   └── test/                    # Tests
├── matching-service/             # Service de Matching Python
│   ├── app/
│   │   ├── api/                 # Routes FastAPI
│   │   ├── services/            # Logique métier
│   │   ├── models/              # Modèles Pydantic
│   │   └── core/                # Configuration
│   └── tests/                   # Tests Python
├── .github/workflows/           # CI/CD GitHub Actions
├── docker-compose.yml           # Configuration Docker
├── Dockerfile.api              # Docker API
├── Dockerfile.matching         # Docker Matching Service
└── API_ROUTES.md               # Documentation routes
```

## 🧪 Tests

### API Principale
```bash
cd main-api

# Tests unitaires
npm run test

# Tests d'intégration
npm run test:e2e

# Coverage
npm run test:cov
```

### Service de Matching
```bash
cd matching-service

# Tests Python
pytest tests/

# Avec coverage
pytest --cov=app tests/
```

## 🚀 Déploiement

### CI/CD
Le projet inclut une pipeline GitHub Actions qui :
- Lance les tests automatiquement
- Build les images Docker
- Scan de sécurité avec Trivy
- Déploiement automatique (à configurer)

### Production
1. Configurez les variables d'environnement de production
2. Utilisez les images Docker buildées
3. Configurez un proxy inverse (Nginx)
4. Mettez en place la surveillance (logs, métriques)

### Variables d'Environnement Importantes

#### API Principale
```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=<secret-fort>
GOOGLE_CLIENT_ID=<google-oauth>
APPLE_CLIENT_ID=<apple-oauth>
FCM_SERVER_KEY=<firebase-key>
REVENUECAT_API_KEY=<revenuecat-key>
```

#### Service Matching
```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
API_KEY=<service-secret>
MAIN_API_URL=https://api.goldwen.com
```

## 🔧 Configuration

### Personnalisation de l'Algorithme de Matching
Le service de matching permet de configurer :
- Poids de compatibilité personnalité vs préférences
- Score minimum de compatibilité
- Taille des sélections quotidiennes
- Paramètres de distance géographique

### Notifications Push
Configuration FCM requise pour :
- Notifications sélection quotidienne (12h00)
- Alertes nouveaux matches
- Messages entrants
- Chat expirant

### Paiements
Intégration RevenueCat pour :
- Abonnements iOS/Android
- Webhooks de validation
- Gestion des renouvellements
- Analytics abonnements

## 📊 Monitoring et Logs

### Logs Structurés
- Format JSON en production
- Corrélation avec trace IDs
- Logs centralisés par service

### Métriques Recommandées
- Temps de réponse API
- Taux de matching
- Engagement chat
- Conversions abonnements

### Health Checks
- `/health` pour chaque service
- Vérification BDD et cache
- Monitoring automatique

## 🔒 Sécurité

### Implémenté
- Authentification JWT sécurisée
- Validation stricte des entrées
- Rate limiting par IP/utilisateur
- Chiffrement des mots de passe (bcrypt)
- CORS configuré
- Variables d'environnement sécurisées

### RGPD / Conformité
- Consentement explicite
- Droit à l'oubli (suppression compte)
- Export des données utilisateur
- Minimisation des données
- Anonymisation analytics

## 🤝 Contribution

### Standards de Code
- ESLint + Prettier pour TypeScript
- Black + isort pour Python
- Tests obligatoires pour nouvelles fonctionnalités
- Documentation des APIs

### Workflow Git
1. Fork du repository
2. Branche feature/ pour nouvelles fonctionnalités
3. Tests passants requis
4. Code review obligatoire
5. Merge sur develop, puis main

## 📄 Licence

Ce projet est développé pour GoldWen. Tous droits réservés.

## 🆘 Support

Pour toute question technique :
1. Consultez la documentation API
2. Vérifiez les logs des services
3. Utilisez les health checks
4. Contactez l'équipe de développement

---

**GoldWen - Designed to be deleted** ❤️