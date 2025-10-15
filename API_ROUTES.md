# GoldWen API Routes Documentation

Cette documentation liste toutes les routes API disponibles pour le frontend et le service de matching de l'application GoldWen.

# GoldWen API Routes Documentation

Cette documentation liste toutes les routes API disponibles pour le frontend et le service de matching de l'application GoldWen.

## 📊 Implementation Status

**✅ Fully Implemented**
- Structured logging with JSON format and trace IDs
- Request/response logging middleware with global interceptors
- Global exception filters with proper error handling
- Health check endpoint with service status monitoring
- Complete notifications module with FCM integration
- Admin panel with comprehensive logging and role-based access
- All authentication routes with OAuth support
- User management routes with statistics and preferences
- Profile management routes with photo uploads
- Matching system integration with daily selections
- Chat functionality with real-time WebSocket support
- Subscription management with RevenueCat integration
- Notifications system with user preferences
- Reports system with user and message reporting (anti-spam protection)

**🔄 Enhanced Features**
- Environment-based log levels (LOG_LEVEL=debug|info|warn|error)
- Centralized logging service with correlation IDs
- Security event logging for admin actions
- Business event tracking for all major operations
- Error tracking with full stack traces
- Global validation pipes with whitelist and transform
- Response interceptors for performance monitoring
- Development environment setup scripts

## Base URL
- **API Principal**: `http://localhost:3000/api/v1`
- **Service Matching**: `http://localhost:8000/api/v1`
- **Documentation Swagger**: `http://localhost:3000/api/v1/docs`

---

## 🏥 Health & Monitoring Routes

### GET /
**Description**: API Welcome message  
**Response**: Welcome message

### GET /health
**Description**: Service health check  
**Response**: 
```json
{
  "status": "ok",
  "timestamp": "2025-01-XX...",
  "uptime": 12345,
  "environment": "development",
  "version": "1.0.0",
  "services": {
    "api": "healthy",
    "database": "healthy",
    "cache": "healthy"
  }
}
```

---

## 🔐 Authentication Routes

### POST /auth/register
**Description**: Inscription d'un nouvel utilisateur  
**Body**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```
**Response**: Token JWT + informations utilisateur

### POST /auth/login
**Description**: Connexion avec email/mot de passe  
**Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
**Response**: Token JWT + informations utilisateur

### POST /auth/social-login
**Description**: Connexion sociale (Google/Apple)  
**Body**:
```json
{
  "socialId": "google_user_id_123",
  "provider": "google",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

### GET /auth/google
**Description**: Redirection vers l'authentification Google

### GET /auth/google/callback
**Description**: Callback OAuth Google

### GET /auth/apple
**Description**: Redirection vers l'authentification Apple

### GET /auth/apple/callback
**Description**: Callback OAuth Apple

### POST /auth/forgot-password
**Description**: Demande de réinitialisation de mot de passe  
**Body**:
```json
{
  "email": "user@example.com"
}
```

### POST /auth/reset-password
**Description**: Réinitialisation du mot de passe avec token  
**Body**:
```json
{
  "token": "reset_token",
  "newPassword": "newpassword123"
}
```

### POST /auth/change-password
**Description**: Changement de mot de passe (authentifié)  
**Headers**: `Authorization: Bearer <token>`  
**Body**:
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

### POST /auth/verify-email
**Description**: Vérification de l'adresse email  
**Body**:
```json
{
  "token": "verification_token"
}
```

### GET /auth/me
**Description**: Récupération du profil utilisateur actuel  
**Headers**: `Authorization: Bearer <token>`

---

## 👤 Users Routes

### GET /users/me
**Description**: Récupération du profil utilisateur complet  
**Headers**: `Authorization: Bearer <token>`

### PUT /users/me
**Description**: Mise à jour des informations utilisateur  
**Headers**: `Authorization: Bearer <token>`  
**Body**:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "fcmToken": "firebase_token",
  "notificationsEnabled": true
}
```

### PUT /users/me/settings
**Description**: Mise à jour des paramètres utilisateur  
**Headers**: `Authorization: Bearer <token>`  
**Body**:
```json
{
  "notificationsEnabled": true,
  "emailNotifications": true,
  "pushNotifications": true
}
```

### GET /users/me/stats
**Description**: Statistiques de l'utilisateur  
**Headers**: `Authorization: Bearer <token>`

### PUT /users/me/deactivate
**Description**: Désactivation du compte utilisateur  
**Headers**: `Authorization: Bearer <token>`

### DELETE /users/me
**Description**: Suppression du compte utilisateur  
**Headers**: `Authorization: Bearer <token>`

### POST /users/me/push-tokens
**Description**: Enregistrement d'un token de notification push  
**Headers**: `Authorization: Bearer <token>`  
**Body**:
```json
{
  "token": "firebase_device_token_here",
  "platform": "ios",
  "appVersion": "1.0.0",
  "deviceId": "device-unique-id"
}
```

### DELETE /users/me/push-tokens
**Description**: Suppression d'un token de notification push  
**Headers**: `Authorization: Bearer <token>`  
**Body**:
```json
{
  "token": "firebase_device_token_here"
}
```

---

## 📝 Profiles Routes

### GET /profiles/me
**Description**: Récupération du profil complet avec photos et réponses  
**Headers**: `Authorization: Bearer <token>`  
**Response**: Retourne le profil complet incluant le champ `pseudo` (nom d'utilisateur)
```json
{
  "id": "uuid",
  "userId": "uuid",
  "firstName": "John",
  "lastName": "Doe",
  "pseudo": "johndoe123",
  "birthDate": "1990-01-01",
  "gender": "man",
  "interestedInGenders": ["woman"],
  "bio": "Description de profil",
  "jobTitle": "Développeur",
  "company": "Tech Corp",
  "education": "Master en Informatique",
  "location": "Paris, France",
  "latitude": 48.8566,
  "longitude": 2.3522,
  "maxDistance": 50,
  "minAge": 25,
  "maxAge": 35,
  "interests": ["voyage", "cuisine", "sport"],
  "languages": ["français", "anglais"],
  "height": 175,
  "favoriteSong": "Bohemian Rhapsody by Queen",
  "isVerified": false,
  "isVisible": true,
  "showAge": true,
  "showDistance": true,
  "showMeInDiscovery": true,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

### PUT /profiles/me
**Description**: Mise à jour des informations de profil (incluant le pseudo/nom d'utilisateur)  
**Headers**: `Authorization: Bearer <token>`  
**Body**:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "pseudo": "johndoe123",
  "birthDate": "1990-01-01",
  "gender": "woman",
  "interestedInGenders": ["man"],
  "bio": "Description de profil",
  "jobTitle": "Développeuse",
  "company": "Tech Corp",
  "education": "Master en Informatique",
  "location": "Paris, France",
  "latitude": 48.8566,
  "longitude": 2.3522,
  "maxDistance": 50,
  "minAge": 25,
  "maxAge": 35,
  "interests": ["voyage", "cuisine", "sport"],
  "languages": ["français", "anglais"],
  "height": 170,
  "favoriteSong": "Imagine by John Lennon"
}
```

### POST /profiles/me/photos
**Description**: Upload d'une nouvelle photo  
**Headers**: `Authorization: Bearer <token>`  
**Content-Type**: `multipart/form-data`  
**Body**: File upload avec metadata

### POST /profiles/me/media
**Description**: Upload de média (alias pour /profiles/me/photos)  
**Headers**: `Authorization: Bearer <token>`  
**Content-Type**: `multipart/form-data`  
**Body**: File upload avec metadata  
**Note**: Cet endpoint est un alias pour l'upload de photos. Utilisez le champ `photos` dans le formulaire multipart.

### PUT /profiles/me/photos/:photoId
**Description**: Mise à jour de l'ordre des photos  
**Headers**: `Authorization: Bearer <token>`

### DELETE /profiles/me/photos/:photoId
**Description**: Suppression d'une photo  
**Headers**: `Authorization: Bearer <token>`

### PUT /profiles/me/photos/:photoId/primary
**Description**: Définir une photo comme principale  
**Headers**: `Authorization: Bearer <token>`

### GET /profiles/questions
**Description**: Récupération des questions de personnalité disponibles

### POST /profiles/me/personality-answers
**Description**: Soumission des réponses au questionnaire de personnalité  
**Headers**: `Authorization: Bearer <token>`  
**Body**:
```json
{
  "answers": [
    {
      "questionId": "uuid",
      "textAnswer": "Réponse textuelle",
      "numericAnswer": 5,
      "booleanAnswer": true,
      "multipleChoiceAnswer": ["option1", "option2"]
    }
  ]
}
```

### GET /profiles/prompts
**Description**: Récupération des prompts disponibles

### POST /profiles/me/prompt-answers
**Description**: Soumission des réponses aux prompts  
**Headers**: `Authorization: Bearer <token>`  
**Body**:
```json
{
  "answers": [
    {
      "promptId": "uuid",
      "answer": "Ma réponse au prompt",
      "order": 1
    }
  ]
}
```

### GET /profiles/:userId
**Description**: Récupération d'un profil public par ID  
**Headers**: `Authorization: Bearer <token>`

---

## 💕 Matching Routes

### GET /matching/daily-selection
**Description**: Récupération de la sélection quotidienne  
**Headers**: `Authorization: Bearer <token>`  
**Response**:
```json
{
  "profiles": [...],
  "metadata": {
    "date": "2025-01-XX",
    "choicesRemaining": 3,
    "choicesMade": 0,
    "maxChoices": 3,
    "refreshTime": "2025-01-XX T12:00:00.000Z"
  }
}
```

### POST /matching/choose/:targetUserId
**Description**: Choisir un profil de la sélection quotidienne  
**Headers**: `Authorization: Bearer <token>`  
**Guards**: QuotaGuard (enforces daily quota limits)  
**Body**:
```json
{
  "choice": "like" | "pass"
}
```
**Response (Success)**:
```json
{
  "success": true,
  "data": {
    "isMatch": false,
    "choicesRemaining": 2,
    "message": "Votre choix a été enregistré ! Il vous reste 2 choix aujourd'hui.",
    "canContinue": true
  }
}
```
**Response (Quota Exceeded - 403)**:
```json
{
  "statusCode": 403,
  "message": "Vous avez utilisé vos 3 choix quotidiens. Revenez demain pour de nouveaux profils !",
  "error": "Forbidden"
}
```

**Quota Rules**:
- Free users: 1 choice/day
- GoldWen Plus: 3 choices/day
- Reset: Daily at midnight (00:00)
- New selections: Daily at noon (12:00)

### GET /matching/matches
**Description**: Liste des matches de l'utilisateur  
**Headers**: `Authorization: Bearer <token>`  
**Query Parameters**: `page`, `limit`, `status`

### GET /matching/matches/:matchId
**Description**: Détails d'un match spécifique  
**Headers**: `Authorization: Bearer <token>`

### DELETE /matching/matches/:matchId
**Description**: Supprimer un match  
**Headers**: `Authorization: Bearer <token>`

### GET /matching/compatibility/:profileId
**Description**: Calcul de compatibilité avec un profil  
**Headers**: `Authorization: Bearer <token>`

---

## 💬 Conversations Routes

### POST /conversations
**Description**: Créer une conversation pour un match mutuel  
**Headers**: `Authorization: Bearer <token>`  
**Body**:
```json
{
  "matchId": "uuid-du-match"
}
```

### GET /conversations
**Description**: Liste des conversations actives  
**Headers**: `Authorization: Bearer <token>`

### GET /conversations/:id/messages
**Description**: Messages d'une conversation  
**Headers**: `Authorization: Bearer <token>`  
**Query Parameters**: `page`, `limit`, `before`

### POST /conversations/:id/messages
**Description**: Envoyer un message  
**Headers**: `Authorization: Bearer <token>`  
**Body**:
```json
{
  "type": "text",
  "content": "Contenu du message"
}
```

### PUT /conversations/:id/messages/read
**Description**: Marquer les messages comme lus  
**Headers**: `Authorization: Bearer <token>`

### DELETE /conversations/:id/messages/:messageId
**Description**: Supprimer un message  
**Headers**: `Authorization: Bearer <token>`

---

## 💬 Chat Routes (Legacy - use /conversations instead)

### GET /chat/conversations
**Description**: Liste des conversations actives  
**Headers**: `Authorization: Bearer <token>`

### GET /chat/conversations/:chatId
**Description**: Détails d'une conversation  
**Headers**: `Authorization: Bearer <token>`

### GET /chat/conversations/:chatId/messages
**Description**: Messages d'une conversation  
**Headers**: `Authorization: Bearer <token>`  
**Query Parameters**: `page`, `limit`, `before`

### POST /chat/conversations/:chatId/messages
**Description**: Envoyer un message  
**Headers**: `Authorization: Bearer <token>`  
**Body**:
```json
{
  "type": "text",
  "content": "Contenu du message"
}
```

### PUT /chat/conversations/:chatId/messages/:messageId/read
**Description**: Marquer un message comme lu  
**Headers**: `Authorization: Bearer <token>`

### DELETE /chat/conversations/:chatId/messages/:messageId
**Description**: Supprimer un message  
**Headers**: `Authorization: Bearer <token>`

### GET /chat/conversations/:chatId/typing
**Description**: Statut "en train d'écrire"  
**Headers**: `Authorization: Bearer <token>`

### POST /chat/conversations/:chatId/typing
**Description**: Indiquer que l'utilisateur écrit  
**Headers**: `Authorization: Bearer <token>`

---

## 💳 Subscriptions Routes

### GET /subscriptions/plans
**Description**: Liste des plans d'abonnement disponibles

### GET /subscriptions/me
**Description**: Abonnement actuel de l'utilisateur  
**Headers**: `Authorization: Bearer <token>`

### GET /subscriptions/tier
**Description**: Niveau d'abonnement et fonctionnalités de l'utilisateur  
**Headers**: `Authorization: Bearer <token>`

### POST /subscriptions
**Description**: Créer un nouvel abonnement  
**Headers**: `Authorization: Bearer <token>`  
**Body**:
```json
{
  "plan": "goldwen_plus",
  "revenueCatCustomerId": "customer_id",
  "revenueCatSubscriptionId": "subscription_id",
  "price": 19.99,
  "currency": "EUR",
  "platform": "ios"
}
```

### PUT /subscriptions/cancel
**Description**: Annulation de l'abonnement utilisateur  
**Headers**: `Authorization: Bearer <token>`
**Body**:
```json
{
  "reason": "too_expensive"
}
```

### DELETE /subscriptions/:id
**Description**: Annuler un abonnement par ID  
**Headers**: `Authorization: Bearer <token>`

### POST /subscriptions/restore
**Description**: Restauration d'un abonnement  
**Headers**: `Authorization: Bearer <token>`

### GET /subscriptions/usage
**Description**: Utilisation actuelle des fonctionnalités premium et quotas quotidiens  
**Headers**: `Authorization: Bearer <token>`  
**Response**:
```json
{
  "dailyChoices": {
    "limit": 3,
    "used": 1,
    "remaining": 2,
    "resetTime": "2025-01-XX T12:00:00.000Z"
  },
  "subscription": {
    "tier": "premium",
    "isActive": true
  }
}
```
**Note**: This endpoint returns real-time quota information from the daily_selections table

### POST /subscriptions/webhook/revenuecat
**Description**: Webhook RevenueCat pour la mise à jour automatique des statuts  
**Body**: RevenueCat webhook payload

---

## 🔔 Notifications Routes

### GET /notifications
**Description**: Liste des notifications de l'utilisateur  
**Headers**: `Authorization: Bearer <token>`  
**Query Parameters**: `page`, `limit`, `type`, `read`

### PUT /notifications/:notificationId/read
**Description**: Marquer une notification comme lue  
**Headers**: `Authorization: Bearer <token>`

### PUT /notifications/read-all
**Description**: Marquer toutes les notifications comme lues  
**Headers**: `Authorization: Bearer <token>`

### DELETE /notifications/:notificationId
**Description**: Supprimer une notification  
**Headers**: `Authorization: Bearer <token>`

### PUT /notifications/settings
**Description**: Mise à jour des paramètres de notification  
**Headers**: `Authorization: Bearer <token>`  
**Body**:
```json
{
  "dailySelection": true,
  "newMatches": true,
  "newMessages": true,
  "chatExpiring": true
}
```

### POST /notifications/test
**Description**: Envoyer une notification de test (dev only)  
**Headers**: `Authorization: Bearer <token>`  
**Body**:
```json
{
  "title": "Test Notification",
  "body": "This is a test notification",
  "type": "daily_selection"
}
```
**Note**: Disponible uniquement en environnement de développement

### POST /notifications/send-group
**Description**: Envoyer une notification à un groupe d'utilisateurs (admin only)  
**Headers**: `Authorization: Bearer <token>`  
**Body**:
```json
{
  "userIds": ["user-id-1", "user-id-2"],
  "type": "daily_selection",
  "title": "Notification Title",
  "body": "Notification content",
  "data": {}
}
```

---

## 🚨 Reports Routes

### POST /reports
**Description**: Submit a report for inappropriate content or behavior  
**Headers**: `Authorization: Bearer <token>`  
**Body**:
```json
{
  "targetType": "user",
  "targetId": "123e4567-e89b-12d3-a456-426614174000",
  "reason": "inappropriate_content",
  "description": "Optional additional details..."
}
```
**Response**:
```json
{
  "success": true,
  "reportId": "report-uuid"
}
```

**Notes**:
- `targetType` can be either `"user"` or `"message"`
- `reason` can be: `inappropriate_content`, `harassment`, `spam`, `fake_profile`, or `other`
- Daily limit: 5 reports per user per day
- Duplicate reports are blocked

### GET /reports/me
**Description**: Get current user's submitted reports  
**Headers**: `Authorization: Bearer <token>`  
**Query Parameters**: `page`, `limit`, `status`, `type`  
**Response**: List of user's reports with pagination

---

## 🛡️ Admin Routes

### POST /admin/auth/login
**Description**: Connexion administrateur  
**Body**:
```json
{
  "email": "admin@goldwen.com",
  "password": "admin_password"
}
```

### GET /admin/users
**Description**: Liste des utilisateurs  
**Headers**: `Authorization: Bearer <admin_token>`  
**Query Parameters**: `page`, `limit`, `status`, `search`

### GET /admin/users/:userId
**Description**: Détails d'un utilisateur  
**Headers**: `Authorization: Bearer <admin_token>`

### PUT /admin/users/:userId/status
**Description**: Changer le statut d'un utilisateur  
**Headers**: `Authorization: Bearer <admin_token>`  
**Body**:
```json
{
  "status": "suspended"
}
```

### PATCH /admin/users/:id/suspend
**Description**: Suspendre un utilisateur spécifique  
**Headers**: `Authorization: Bearer <admin_token>`

### DELETE /admin/users/:id
**Description**: Supprimer un utilisateur  
**Headers**: `Authorization: Bearer <admin_token>`

### GET /admin/reports
**Description**: Liste des signalements  
**Headers**: `Authorization: Bearer <admin_token>`  
**Query Parameters**: `page`, `limit`, `status`, `type`

### PUT /admin/reports/:reportId
**Description**: Traiter un signalement  
**Headers**: `Authorization: Bearer <admin_token>`  
**Body**:
```json
{
  "status": "resolved",
  "resolution": "Description de la résolution"
}
```

### DELETE /admin/reports/:reportId
**Description**: Supprimer/rejeter un signalement  
**Headers**: `Authorization: Bearer <admin_token>`

### GET /admin/analytics
**Description**: Statistiques de la plateforme  
**Headers**: `Authorization: Bearer <admin_token>`

### POST /admin/notifications/broadcast
**Description**: Diffuser une notification à tous les utilisateurs  
**Headers**: `Authorization: Bearer <admin_token>`  
**Body**:
```json
{
  "title": "Titre de la notification",
  "body": "Contenu de la notification",
  "type": "system"
}
```

### POST /admin/support/reply
**Description**: Répondre à un ticket de support utilisateur  
**Headers**: `Authorization: Bearer <admin_token>`  
**Body**:
```json
{
  "ticketId": "uuid",
  "reply": "Réponse de l'administrateur",
  "status": "resolved",
  "priority": "medium"
}
```

---

## 🤖 Matching Service Routes (Service Externe - Python)

**Note:** Ces routes sont servies par un service de matching externe qui doit être démarré sur http://localhost:8000.
Le service de matching n'est plus inclus dans ce repository.

### POST /matching-service/calculate-compatibility
**Description**: Calcul de compatibilité entre deux profils (V1 - basé sur la personnalité)  
**Headers**: `X-API-Key: <service_key>`  
**Body**:
```json
{
  "user1Profile": {
    "personalityAnswers": [...],
    "preferences": {...}
  },
  "user2Profile": {
    "personalityAnswers": [...],
    "preferences": {...}
  }
}
```

### POST /matching/calculate-compatibility-v2
**Description**: Calcul de compatibilité avec scoring avancé (V2)  
**Headers**: `X-API-Key: <service_key>`  
**Body**:
```json
{
  "user1Profile": {
    "userId": "string",
    "age": 28,
    "interests": ["hiking", "reading"],
    "personalityAnswers": [...],
    "lastActiveAt": "2025-01-01T12:00:00Z",
    "lastLoginAt": "2025-01-01T11:00:00Z",
    "createdAt": "2024-12-01T10:00:00Z",
    "messagesSent": 50,
    "messagesReceived": 50,
    "matchesCount": 5
  },
  "user2Profile": {
    "userId": "string",
    "age": 30,
    "interests": ["reading", "travel"],
    "personalityAnswers": [...],
    "lastActiveAt": "2025-01-01T10:00:00Z",
    "lastLoginAt": "2025-01-01T09:00:00Z",
    "createdAt": "2024-11-15T10:00:00Z",
    "messagesSent": 40,
    "messagesReceived": 45,
    "matchesCount": 4
  }
}
```
**Response**:
```json
{
  "compatibilityScore": 78.5,
  "version": "v2",
  "details": {
    "communication": 0.85,
    "values": 0.90,
    "lifestyle": 0.75,
    "personality": 0.80
  },
  "advancedFactors": {
    "activityScore": 0.95,
    "responseRateScore": 0.88,
    "reciprocityScore": 0.82,
    "details": {
      "userActivity": 0.96,
      "targetActivity": 0.94,
      "userResponseRate": 0.90,
      "targetResponseRate": 0.86
    }
  },
  "sharedInterests": ["reading"],
  "scoringWeights": {
    "personalityWeight": 0.6,
    "advancedWeight": 0.4
  }
}
```
**Facteurs V2**:
- **Activité utilisateur** (30%): Score basé sur la récence des connexions
- **Taux de réponse** (40%): Ratio messages envoyés/reçus
- **Réciprocité potentielle** (30%): Intérêts communs + alignement préférences

### POST /matching-service/generate-daily-selection
**Description**: Génération de la sélection quotidienne  
**Headers**: `X-API-Key: <service_key>`  
**Body**:
```json
{
  "userId": "uuid",
  "userProfile": {...},
  "availableProfiles": [...],
  "selectionSize": 5
}
```

### POST /matching-service/batch-compatibility
**Description**: Calcul de compatibilité en lot  
**Headers**: `X-API-Key: <service_key>`  
**Body**:
```json
{
  "baseProfile": {...},
  "profilesToCompare": [...]
}
```

### GET /matching-service/algorithm/stats
**Description**: Statistiques de l'algorithme de matching  
**Headers**: `X-API-Key: <service_key>`

---

## 📊 WebSocket Events

### Connexion
```javascript
const socket = io('ws://localhost:3000/chat', {
  auth: {
    token: 'jwt_token'
  }
});
```

### Events Entrants (du serveur vers le client)
- `new_message`: Nouveau message reçu
  ```javascript
  {
    messageId: string,
    conversationId: string,
    senderId: string,
    content: string,
    type: string,
    timestamp: Date
  }
  ```
- `message_read`: Message marqué comme lu avec accusé de lecture
  ```javascript
  {
    conversationId: string,
    messageId: string,
    readBy: string,
    readAt: Date,
    timestamp: Date
  }
  ```
- `conversation_read`: Toute la conversation marquée comme lue
  ```javascript
  {
    conversationId: string,
    readBy: string,
    messageCount: number,
    timestamp: Date
  }
  ```
- `user_typing`: Utilisateur en train d'écrire (indicateur "écrit...")
  ```javascript
  {
    conversationId: string,
    userId: string
  }
  ```
- `user_stopped_typing`: Utilisateur a arrêté d'écrire
  ```javascript
  {
    conversationId: string,
    userId: string
  }
  ```
- `user_presence_changed`: Statut de présence d'un utilisateur a changé
  ```javascript
  {
    userId: string,
    isOnline: boolean,
    timestamp: Date
  }
  ```
- `presence_status`: Réponse avec le statut de présence des utilisateurs
  ```javascript
  {
    statuses: [{
      userId: string,
      isOnline: boolean,
      lastSeen: Date,
      lastSeenFormatted: string  // "Il y a 5 min", "En ligne", etc.
    }]
  }
  ```
- `chat_expired`: Conversation expirée
- `new_match`: Nouveau match
- `match_expired`: Match expiré
- `error`: Erreur WebSocket
  ```javascript
  {
    message: string
  }
  ```

### Events Sortants (du client vers le serveur)
- `join_chat`: Rejoindre une conversation
  ```javascript
  {
    conversationId: string
  }
  ```
- `leave_chat`: Quitter une conversation
  ```javascript
  {
    conversationId: string
  }
  ```
- `send_message`: Envoyer un message
  ```javascript
  {
    conversationId: string,
    content: string,
    type?: string  // 'text' | 'emoji' | 'system'
  }
  ```
- `start_typing`: Commencer à écrire (auto-timeout après 5 secondes)
  ```javascript
  {
    conversationId: string
  }
  ```
- `stop_typing`: Arrêter d'écrire
  ```javascript
  {
    conversationId: string
  }
  ```
- `read_message`: Marquer un message comme lu
  ```javascript
  {
    conversationId: string,
    messageId: string
  }
  ```
- `mark_conversation_read`: Marquer toute la conversation comme lue
  ```javascript
  {
    conversationId: string
  }
  ```
- `get_presence`: Obtenir le statut de présence d'utilisateurs
  ```javascript
  {
    userIds: string[]
  }
  ```

---

## 🔒 Authentication

### JWT Token
- **Header**: `Authorization: Bearer <token>`
- **Expiration**: 24 heures
- **Refresh**: Pas de refresh token dans MVP, reconnexion requise

### OAuth Flows
- **Google**: OAuth 2.0 avec redirection
- **Apple**: Sign in with Apple avec redirection

### Permissions
- **User**: Accès aux routes utilisateur standards
- **Admin**: Accès aux routes d'administration
- **System**: Communication entre microservices

---

## 📱 Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "code": "ERROR_CODE",
  "errors": [
    // Validation errors array
  ]
}
```

### Pagination Response
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

## 🚀 Status Codes

- **200**: OK - Opération réussie
- **201**: Created - Ressource créée
- **400**: Bad Request - Erreur de validation
- **401**: Unauthorized - Authentification requise
- **403**: Forbidden - Permissions insuffisantes
- **404**: Not Found - Ressource introuvable
- **409**: Conflict - Conflit (email déjà utilisé, etc.)
- **422**: Unprocessable Entity - Erreur de logique métier
- **500**: Internal Server Error - Erreur serveur

---

## 🌐 Environment Variables

### API Principal
```bash
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=goldwen
DATABASE_PASSWORD=goldwen_password
DATABASE_NAME=goldwen_db

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

APPLE_CLIENT_ID=your-apple-client-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY=your-apple-private-key

PORT=3000
NODE_ENV=development
API_PREFIX=api/v1
LOG_LEVEL=info                        # Available levels: error, warn, info, debug

FCM_SERVER_KEY=your-fcm-server-key
MATCHING_SERVICE_URL=http://localhost:8000
REVENUECAT_API_KEY=your-revenuecat-api-key
```

### Service Matching (Externe)
```bash
# Variables d'environnement pour le service de matching externe
API_HOST=0.0.0.0
API_PORT=8000
API_PREFIX=/api/v1

DATABASE_URL=postgresql://goldwen:password@localhost:5432/goldwen_db
REDIS_URL=redis://localhost:6379

MAIN_API_URL=http://localhost:3000
API_KEY=matching-service-secret-key

LOG_LEVEL=INFO
```

**Note:** Ces variables doivent être configurées dans le repository du service de matching externe.

---

Cette documentation couvre l'ensemble des routes API nécessaires pour le développement du frontend React Native et l'intégration avec le service de matching Python. Chaque route est documentée avec ses paramètres, exemples de requêtes et réponses pour faciliter l'intégration.