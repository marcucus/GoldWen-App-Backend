# Politique de rétention des données — GoldWen

Durées validées par Adrien le 17 septembre 2026. Règles intégrées au code ; leur activation en production dépend du déploiement, des migrations et des réglages ci-dessous. Source technique : `main-api/src/common/constants/retention.constants.ts`.

| Catégorie | Durée / comportement |
|---|---|
| Profil, photos, questionnaire, préférences | Tant que le compte est actif |
| Inactivité | Suppression après 12 mois calendaires ; avertissement au moins 30 jours avant ; une activité ultérieure annule ce cycle |
| Suppression volontaire | Profil masqué et compte désactivé immédiatement ; effacement dès traitement, sous 30 jours maximum |
| Messages ordinaires | Accessibles pendant les 24 h du chat ; suppression physique sous 24 h supplémentaires |
| Sélections et choix | 90 jours |
| Notifications internes | 30 jours |
| Fichier d’export | Accessible 7 jours à compter de sa disponibilité ; suppression du fichier et de sa référence |
| Support | Pendant traitement puis 12 mois après clôture |
| Signalements et preuves nécessaires | Pendant traitement puis 12 mois après clôture ; preuves extraites réservées à la modération |
| Journaux de sécurité | Maximum 6 mois (rotation applicative 180 jours), sans contenu de conversations |
| Sauvegardes | Maximum 30 jours ; rejouer les effacements avant toute remise en service après restauration |
| Journal minimal des effacements | Identifiant du compte, statut et dates, 30 jours après clôture ; pas d’e-mail, motif, erreur ou métadonnées après effacement |
| Justificatifs de paiement | Exception limitée aux transactions nécessaires, jusqu’à 10 ans ; aucun profil de rencontre conservé |

## Application dans le code

- `RetentionScheduler` tourne quotidiennement à 03:00 UTC : notifications, sélections, tickets clôturés, signalements clôturés, exports et inactivité. L’avertissement exige une livraison d’e-mail réussie : sans transport configuré, aucune date d’avertissement n’est enregistrée et aucune suppression sur cette base n’est autorisée.
- L’activité utilise la date la plus récente entre création, connexion et requête authentifiée. La stratégie JWT actualise la présence au maximum une fois par heure. L’inactivité et l’avertissement sont revérifiés sous verrou avant effacement.
- `ChatScheduler.cleanupOldChats` tourne toutes les cinq minutes. Le seuil est 23 h 55 après expiration, afin que le passage suivant reste dans les 24 h de grâce. L’accès doit toujours être refusé dès `expiresAt`, indépendamment du scheduler d’expiration.
- `UserDataService` efface les photos et exports du stockage avant de supprimer les références. Un échec du stockage fait échouer la transaction ; les opérations sont idempotentes pour la reprise. Les références du compte dans les sélections des autres utilisateurs sont retirées.
- Les demandes de suppression volontaire passent par le même parcours, y compris `DELETE /users/me`. `GdprService` reprend chaque heure les demandes en attente/échouées et les traitements interrompus depuis plus d’une heure. Les nouvelles tentatives supposent que le service et ses dépendances fonctionnent ; surveiller l’ancienneté des demandes pour garantir le délai de 30 jours.
- Les preuves d’un **message signalé** sont copiées avant suppression dans `reports.retainedEvidence`, champ exclu des lectures ordinaires et inclus uniquement dans le détail protégé par `AdminGuard`. Les relations message/chat et utilisateur passent à `SET NULL`. Le contenu des conversations non signalées n’est pas archivé. Une suspension de purge documentée pour litige peut être limitée par `retentionHoldUntil` (opération réservée à l’administrateur de base, pas de route publique).
- Les tickets et transactions nécessaires survivent à l’effacement avec leur relation utilisateur détachée. Les abonnements sans paiement ni identifiant de transaction sont supprimés ; les identifiants de profil RevenueCat et métadonnées arbitraires sont retirés des autres lignes. Un identifiant de transaction n’est pas une donnée anonyme.
- Winston applique la rotation temporelle aux nouveaux fichiers de production. Les anciens fichiers et copies dans un collecteur externe nécessitent une purge/configuration distincte.
- La vitrine annonce 12 mois après clôture pour les demandes de contact et 6 mois maximum pour les journaux de sécurité. Sa boîte e-mail et les logs Vercel ne sont pas pilotés par le scheduler NestJS.

## Mise en service et restauration

1. Tester les migrations de rétention sur une copie PostgreSQL de staging, dont `1789655000000-PreserveReportedMessageEvidence.ts`, puis exécuter les migrations au déploiement. Vérifier `ON DELETE SET NULL`, les preuves conservées et la suppression réelle des fichiers.
2. Si une ancienne politique de confidentialité existe déjà en base, publier la version 1.1.0 après relecture : depuis `main-api`, `npx ts-node src/scripts/publish-retention-policy.ts`. Le script n’est pas exécuté ici. Les politiques personnalisées existantes ne sont pas réécrites automatiquement ; adapter le texte si nécessaire.
3. Configurer et tester SMTP/SendGrid, le stockage, la purge de la boîte support et des collecteurs de logs. Le test unitaire ne livre aucun e-mail réel. La suppression d’un compte ne résilie pas automatiquement un abonnement Apple/Google.
4. Configurer toutes les copies/snapshots/réplicas : rétention maximale de 30 jours, y compris la rotation locale/S3 du script `scripts/backup.sh`. Les sauvegardes gérées chez les prestataires restent à vérifier.
5. **Avant une restauration**, sauvegarder le journal courant des `account_deletions` dans un emplacement protégé séparé. Une sauvegarde ancienne ne contient pas les suppressions survenues après sa création. Restaurer dans un environnement isolé, rejouer ces identifiants via le service d’effacement, relancer les purges de rétention, vérifier l’absence des données effacées, puis seulement rouvrir le service. Ne jamais restaurer une sauvegarde de plus de 30 jours. La copie séparée du journal doit suivre la même rotation de 30 jours. Ce protocole doit être testé par l’opérateur avant lancement ; aucune garantie sur l’infrastructure réelle n’est revendiquée ici.

## Vérifications locales — 17 septembre 2026

- Backend : TypeScript, ESLint et build vérifiés ; suite complète 71 suites / 640 tests, dont contrôle du refus de purge après reprise d’activité et contrôle des échecs de stockage/e-mail.
- Vitrine : lint, typecheck, 7 tests et build de 54 pages réussis.
- Pas de migration exécutée contre PostgreSQL réel, ni de livraison d’e-mail réelle, ni de déploiement. Les contrôles d’infrastructure ci-dessus restent ouverts.
