import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomLoggerService } from '../../common/logger';
import { User } from '../../database/entities/user.entity';
import { Notification } from '../../database/entities/notification.entity';
import { DailySelection } from '../../database/entities/daily-selection.entity';
import { Report } from '../../database/entities/report.entity';
import { ReportStatus } from '../../common/enums';
import {
  SupportTicket,
  SupportStatus,
} from '../../database/entities/support-ticket.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { DataExportService } from './data-export.service';
import {
  INACTIVE_ACCOUNT_MONTHS,
  INACTIVE_ACCOUNT_WARNING_DAYS_BEFORE,
  SELECTION_HISTORY_DAYS,
  NOTIFICATION_RETENTION_DAYS,
  SUPPORT_TICKET_RETENTION_MONTHS_AFTER_CLOSURE,
  REPORT_RETENTION_MONTHS_AFTER_CLOSURE,
  ACCOUNTING_RECORD_RETENTION_YEARS,
} from '../../common/constants/retention.constants';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

function yearsAgo(n: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d;
}

/**
 * Applique la politique de rétention des données GoldWen validée le
 * 2026-09-17 (voir docs/DATA_RETENTION_POLICY.md pour le détail et les
 * durées exactes, centralisées dans common/constants/retention.constants.ts).
 *
 * Ce que ce scheduler NE couvre PAS (volontairement, voir le document
 * ci-dessus pour le détail) :
 * - Les messages/chats : purgés par ChatScheduler.cleanupOldChats (24h
 *   d'accès + 24h de grâce après expiration), pas ici.
 * - La rotation des sauvegardes : dépend de la configuration de
 *   l'hébergeur, hors du périmètre de ce code.
 *
 * Depuis la migration AddSetNullRetentionForeignKeys, les FK
 * reports.reporterId / reportedUserId, support_tickets.userId et
 * subscriptions.userId passent à NULL (au lieu d'être supprimées en
 * cascade) quand le compte utilisateur est supprimé, pour que ces
 * enregistrements survivent le temps de leur propre durée de conservation.
 * `purgeOldAnonymizedSubscriptions` applique l'exception comptable (jusqu'à
 * 10 ans, sans profil associé) sur les abonnements orphelins.
 */
@Injectable()
export class RetentionScheduler {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(DailySelection)
    private readonly dailySelectionRepository: Repository<DailySelection>,
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(SupportTicket)
    private readonly supportTicketRepository: Repository<SupportTicket>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly notificationsService: NotificationsService,
    private readonly dataExportService: DataExportService,
    private readonly logger: CustomLoggerService,
  ) {}

  /** Runs daily at 03:00 UTC — after nightly backup. */
  @Cron('0 3 * * *', { name: 'gdpr-data-retention', timeZone: 'UTC' })
  async runRetention() {
    const jobId = `retention-${Date.now()}`;
    this.logger.info('GDPR retention job started', { jobId });

    await Promise.allSettled([
      this.warnInactiveAccounts(jobId),
      this.purgeInactiveAccounts(jobId),
      this.purgeOldNotifications(jobId),
      this.purgeOldDailySelections(jobId),
      this.purgeClosedReports(jobId),
      this.purgeClosedSupportTickets(jobId),
      this.purgeExpiredExports(jobId),
      this.purgeOldAnonymizedSubscriptions(jobId),
    ]);

    this.logger.info('GDPR retention job completed', { jobId });
  }

  /**
   * Avertit les comptes inactifs depuis (12 mois - 30 jours), 30 jours
   * avant leur suppression effective. L'activité de référence est
   * lastActiveAt (présence réelle dans l'app), avec repli sur lastLoginAt
   * puis createdAt si l'utilisateur n'a jamais eu d'activité enregistrée.
   *
   * Un avertissement n'est renvoyé que s'il n'y en a pas déjà un valide
   * pour la période d'inactivité en cours : si l'utilisateur redevient
   * actif après avoir été averti, `inactivityWarningSentAt` devient
   * automatiquement plus ancien que sa nouvelle activité et un nouveau
   * cycle recommencera naturellement au prochain passage en inactivité.
   */
  private async warnInactiveAccounts(jobId: string) {
    try {
      const warnCutoff = monthsAgo(INACTIVE_ACCOUNT_MONTHS);
      warnCutoff.setDate(
        warnCutoff.getDate() + INACTIVE_ACCOUNT_WARNING_DAYS_BEFORE,
      );

      const usersToWarn = await this.userRepository
        .createQueryBuilder('user')
        .where(
          'COALESCE(user.lastActiveAt, user.lastLoginAt, user.createdAt) < :warnCutoff',
          { warnCutoff },
        )
        .andWhere(
          '(user.inactivityWarningSentAt IS NULL OR user.inactivityWarningSentAt < COALESCE(user.lastActiveAt, user.lastLoginAt, user.createdAt))',
        )
        .select(['user.id'])
        .getMany();

      let warned = 0;
      for (const user of usersToWarn) {
        try {
          await this.notificationsService.sendAccountInactivityWarningNotification(
            user.id,
            INACTIVE_ACCOUNT_WARNING_DAYS_BEFORE,
          );
          await this.userRepository.update(user.id, {
            inactivityWarningSentAt: new Date(),
          });
          warned++;
        } catch (error: unknown) {
          this.logger.error(
            `Failed to warn inactive user ${user.id}`,
            error instanceof Error ? error.message : String(error),
            'RetentionScheduler',
          );
        }
      }

      this.logger.info('Warned inactive accounts', { jobId, warned });
    } catch (error: unknown) {
      this.logger.error(
        'Failed to warn inactive accounts',
        error instanceof Error ? error.message : String(error),
        'RetentionScheduler',
      );
    }
  }

  /**
   * Supprime les comptes dont l'avertissement d'inactivité a été envoyé il
   * y a au moins INACTIVE_ACCOUNT_WARNING_DAYS_BEFORE jours, et dont
   * l'utilisateur n'a pas été actif depuis (l'avertissement reste "valide"
   * pour la période d'inactivité en cours).
   */
  private async purgeInactiveAccounts(jobId: string) {
    try {
      const deletionCutoff = daysAgo(INACTIVE_ACCOUNT_WARNING_DAYS_BEFORE);

      const usersToDelete = await this.userRepository
        .createQueryBuilder('user')
        .where('user.inactivityWarningSentAt IS NOT NULL')
        .andWhere('user.inactivityWarningSentAt <= :deletionCutoff', {
          deletionCutoff,
        })
        .andWhere(
          'user.inactivityWarningSentAt >= COALESCE(user.lastActiveAt, user.lastLoginAt, user.createdAt)',
        )
        .select(['user.id'])
        .getMany();

      let deleted = 0;
      for (const user of usersToDelete) {
        try {
          await this.userRepository.delete({ id: user.id });
          deleted++;
        } catch (error: unknown) {
          this.logger.error(
            `Failed to delete inactive user ${user.id}`,
            error instanceof Error ? error.message : String(error),
            'RetentionScheduler',
          );
        }
      }

      this.logger.info('Purged inactive accounts', {
        jobId,
        deleted,
        deletionCutoff: deletionCutoff.toISOString(),
      });
    } catch (error: unknown) {
      this.logger.error(
        'Failed to purge inactive accounts',
        error instanceof Error ? error.message : String(error),
        'RetentionScheduler',
      );
    }
  }

  private async purgeOldNotifications(jobId: string) {
    try {
      const cutoff = daysAgo(NOTIFICATION_RETENTION_DAYS);
      const result = await this.notificationRepository
        .createQueryBuilder()
        .delete()
        .where('createdAt < :cutoff', { cutoff })
        .execute();
      this.logger.info('Purged old notifications', {
        jobId,
        deleted: result.affected ?? 0,
        cutoff: cutoff.toISOString(),
      });
    } catch (error: unknown) {
      this.logger.error(
        'Failed to purge old notifications',
        error instanceof Error ? error.message : String(error),
        'RetentionScheduler',
      );
    }
  }

  private async purgeOldDailySelections(jobId: string) {
    try {
      const cutoff = daysAgo(SELECTION_HISTORY_DAYS);
      const result = await this.dailySelectionRepository
        .createQueryBuilder()
        .delete()
        .where('createdAt < :cutoff', { cutoff })
        .execute();
      this.logger.info('Purged old daily selections', {
        jobId,
        deleted: result.affected ?? 0,
        cutoff: cutoff.toISOString(),
      });
    } catch (error: unknown) {
      this.logger.error(
        'Failed to purge old daily selections',
        error instanceof Error ? error.message : String(error),
        'RetentionScheduler',
      );
    }
  }

  /**
   * Signalements clôturés (résolus ou classés sans suite) : conservés 12
   * mois après clôture pour la modération, puis supprimés. Les
   * signalements en attente (PENDING) ne sont jamais purgés ici.
   */
  private async purgeClosedReports(jobId: string) {
    try {
      const cutoff = monthsAgo(REPORT_RETENTION_MONTHS_AFTER_CLOSURE);
      const result = await this.reportRepository
        .createQueryBuilder()
        .delete()
        .where('status IN (:...closedStatuses)', {
          closedStatuses: [ReportStatus.RESOLVED, ReportStatus.DISMISSED],
        })
        .andWhere('"updatedAt" < :cutoff', { cutoff })
        .execute();
      this.logger.info('Purged closed reports', {
        jobId,
        deleted: result.affected ?? 0,
        cutoff: cutoff.toISOString(),
      });
    } catch (error: unknown) {
      this.logger.error(
        'Failed to purge closed reports',
        error instanceof Error ? error.message : String(error),
        'RetentionScheduler',
      );
    }
  }

  /** Tickets support clôturés : conservés 12 mois après clôture. */
  private async purgeClosedSupportTickets(jobId: string) {
    try {
      const cutoff = monthsAgo(SUPPORT_TICKET_RETENTION_MONTHS_AFTER_CLOSURE);
      const result = await this.supportTicketRepository
        .createQueryBuilder()
        .delete()
        .where('status IN (:...closedStatuses)', {
          closedStatuses: [SupportStatus.RESOLVED, SupportStatus.CLOSED],
        })
        .andWhere('"updatedAt" < :cutoff', { cutoff })
        .execute();
      this.logger.info('Purged closed support tickets', {
        jobId,
        deleted: result.affected ?? 0,
        cutoff: cutoff.toISOString(),
      });
    } catch (error: unknown) {
      this.logger.error(
        'Failed to purge closed support tickets',
        error instanceof Error ? error.message : String(error),
        'RetentionScheduler',
      );
    }
  }

  /**
   * Exception légale/comptable : un abonnement dont le compte a été
   * supprimé (userId devenu NULL via onDelete: 'SET NULL') est conservé
   * comme pièce comptable jusqu'à ACCOUNTING_RECORD_RETENTION_YEARS (10
   * ans) à compter de sa création, sans conserver le profil de rencontre
   * associé (déjà supprimé avec le compte). Un abonnement dont le compte
   * existe toujours n'est jamais purgé ici.
   */
  private async purgeOldAnonymizedSubscriptions(jobId: string) {
    try {
      const cutoff = yearsAgo(ACCOUNTING_RECORD_RETENTION_YEARS);
      const result = await this.subscriptionRepository
        .createQueryBuilder()
        .delete()
        .where('"userId" IS NULL')
        .andWhere('"createdAt" < :cutoff', { cutoff })
        .execute();
      this.logger.info('Purged old anonymized subscriptions', {
        jobId,
        deleted: result.affected ?? 0,
        cutoff: cutoff.toISOString(),
      });
    } catch (error: unknown) {
      this.logger.error(
        'Failed to purge old anonymized subscriptions',
        error instanceof Error ? error.message : String(error),
        'RetentionScheduler',
      );
    }
  }

  /**
   * Supprime du stockage les fichiers d'export de données GDPR expirés
   * (Art. 20 RGPD, 7 jours) — délégué à DataExportService qui a accès au
   * StorageService.
   */
  private async purgeExpiredExports(jobId: string) {
    try {
      const purged = await this.dataExportService.purgeExpiredExports();
      this.logger.info('Purged expired data exports', { jobId, purged });
    } catch (error: unknown) {
      this.logger.error(
        'Failed to purge expired data exports',
        error instanceof Error ? error.message : String(error),
        'RetentionScheduler',
      );
    }
  }
}
