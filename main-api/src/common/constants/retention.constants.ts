/**
 * Durées de conservation des données GoldWen.
 *
 * Source de vérité unique pour la politique de rétention validée le
 * 2026-09-17 (voir docs/DATA_RETENTION_POLICY.md pour le détail complet et
 * les articles RGPD associés). Chaque scheduler/service de purge doit
 * référencer ces constantes plutôt que coder une durée en dur, pour que la
 * politique reste modifiable à un seul endroit.
 */

/** Solde de délai laissé avant de considérer un compte "inactif". */
export const INACTIVE_ACCOUNT_MONTHS = 12;

/** Nombre de jours avant la suppression pour compte inactif où un
 * avertissement est envoyé à l'utilisateur. */
export const INACTIVE_ACCOUNT_WARNING_DAYS_BEFORE = 30;

/** Délai maximum entre une demande de suppression volontaire de compte et
 * l'effacement effectif des données (Art. 17 RGPD). Le profil est masqué
 * immédiatement dès la demande ; la suppression effective actuelle est
 * quasi instantanée, donc largement sous ce plafond. */
export const VOLUNTARY_DELETION_MAX_DAYS = 30;

/** Fenêtre d'accès aux messages d'un chat avant expiration (24h après le
 * match) — voir chat.service.ts où `expiresAt = matchedAt + 24h`. */
export const MESSAGE_ACCESS_HOURS = 24;

/** Délai de grâce après expiration du chat avant suppression définitive des
 * messages et du chat (24h supplémentaires). */
export const MESSAGE_DELETION_GRACE_HOURS = 24;

/** Historique des sélections quotidiennes et choix effectués. */
export const SELECTION_HISTORY_DAYS = 90;

/** Notifications internes (in-app). */
export const NOTIFICATION_RETENTION_DAYS = 30;

/** Durée de disponibilité d'un export de données avant suppression du
 * fichier (Art. 20 RGPD) — voir data-export-request.entity.ts `expiresAt`,
 * fixé à la création + 7 jours. */
export const EXPORT_FILE_RETENTION_DAYS = 7;

/** Tickets support : conservés jusqu'à 12 mois après clôture. */
export const SUPPORT_TICKET_RETENTION_MONTHS_AFTER_CLOSURE = 12;

/** Signalements et preuves associées : conservés pendant le traitement,
 * puis 12 mois après clôture, avec accès restreint à la modération. */
export const REPORT_RETENTION_MONTHS_AFTER_CLOSURE = 12;

/** Logs de sécurité (sans contenu des conversations). */
export const SECURITY_LOG_RETENTION_MONTHS = 6;

/**
 * Rotation des sauvegardes. Non appliqué par ce code — dépend de la
 * configuration de l'hébergeur (politique de snapshot/backup de la base de
 * données gérée). Voir docs/DATA_RETENTION_POLICY.md, section "Dépendances
 * hébergement".
 */
export const BACKUP_ROTATION_DAYS = 30;

/**
 * Exception "obligation légale/comptable" : les pièces comptables
 * (abonnements/paiements) peuvent devoir être conservées 10 ans, sans
 * conserver le profil de rencontre associé. Voir la note d'architecture
 * dans docs/DATA_RETENTION_POLICY.md — non appliqué automatiquement par un
 * scheduler dans cette version (décision produit/architecture en attente
 * de confirmation, cf. section dédiée).
 */
export const ACCOUNTING_RECORD_RETENTION_YEARS = 10;
