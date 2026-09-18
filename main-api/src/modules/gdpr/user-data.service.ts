import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Profile } from '../../database/entities/profile.entity';
import { Match } from '../../database/entities/match.entity';
import { Message } from '../../database/entities/message.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { DailySelection } from '../../database/entities/daily-selection.entity';
import { UserConsent } from '../../database/entities/user-consent.entity';
import { PushToken } from '../../database/entities/push-token.entity';
import { Notification } from '../../database/entities/notification.entity';
import { Report } from '../../database/entities/report.entity';
import { StorageService } from '../../common/services/storage.service';

@Injectable()
export class UserDataService {
  private readonly logger = new Logger(UserDataService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(DailySelection)
    private dailySelectionRepository: Repository<DailySelection>,
    @InjectRepository(UserConsent)
    private userConsentRepository: Repository<UserConsent>,
    @InjectRepository(PushToken)
    private pushTokenRepository: Repository<PushToken>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Export all user data in a structured format
   */
  async exportUserData(userId: string, format: 'json' | 'pdf' = 'json') {
    // PDF generation isn't implemented; reject explicitly rather than
    // silently returning JSON while claiming PDF (same choice as
    // StatsService.exportStats for CSV/PDF). JSON alone already satisfies
    // the GDPR Art. 20 "portable copy" requirement (specifications.md,
    // Annexe A).
    if (format !== 'json') {
      throw new BadRequestException('Only JSON exports are supported');
    }
    this.logger.log(
      `Starting data export for user ${userId} in ${format} format`,
    );

    const userData = await this.collectUserData(userId);

    return {
      exportedAt: new Date().toISOString(),
      userId: userId,
      data: userData,
    };
  }

  /**
   * Collect all user data from different entities
   */
  private async collectUserData(userId: string) {
    const [
      user,
      profile,
      matches,
      messages,
      subscriptions,
      dailySelections,
      consents,
      pushTokens,
      notifications,
      reports,
    ] = await Promise.all([
      this.userRepository.findOne({
        where: { id: userId },
        select: [
          'id',
          'email',
          'status',
          'isEmailVerified',
          'isOnboardingCompleted',
          'isProfileCompleted',
          'notificationsEnabled',
          'lastLoginAt',
          'createdAt',
        ],
      }),
      this.profileRepository.findOne({ where: { userId } }),
      this.matchRepository.find({
        where: [{ user1Id: userId }, { user2Id: userId }],
      }),
      this.messageRepository.find({
        where: { senderId: userId },
        order: { createdAt: 'DESC' },
      }),
      this.subscriptionRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
      this.dailySelectionRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
      this.userConsentRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
      this.pushTokenRepository.find({ where: { userId } }),
      this.notificationRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
      this.reportRepository.find({
        where: { reporterId: userId },
        order: { createdAt: 'DESC' },
      }),
    ]);

    return {
      user: this.sanitizeUserData(user),
      profile: this.sanitizeProfileData(profile),
      matches:
        matches?.map((match) => this.sanitizeMatchData(match, userId)) || [],
      messages: messages?.map((msg) => this.sanitizeMessageData(msg)) || [],
      subscriptions:
        subscriptions?.map((sub) => this.sanitizeSubscriptionData(sub)) || [],
      dailySelections:
        dailySelections?.map((sel) => this.sanitizeDailySelectionData(sel)) ||
        [],
      consents:
        consents?.map((consent) => this.sanitizeConsentData(consent)) || [],
      pushTokens:
        pushTokens?.map((token) => this.sanitizePushTokenData(token)) || [],
      notifications:
        notifications?.map((notif) => this.sanitizeNotificationData(notif)) ||
        [],
      reports: reports?.map((report) => this.sanitizeReportData(report)) || [],
    };
  }

  /**
   * Complete user account deletion with anonymization
   */
  async deleteUserCompletely(
    userId: string,
    inactivity?: { cutoff: Date; warningCutoff: Date },
  ): Promise<void> {
    this.logger.log(`Starting complete deletion for user ${userId}`);

    await this.userRepository.manager.transaction(async (manager) => {
      if (inactivity) {
        const user = await manager.findOne(User, {
          where: { id: userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user) return;
        const activity = Math.max(
          user.createdAt?.getTime() ?? Date.now(),
          user.lastActiveAt?.getTime() ?? 0,
          user.lastLoginAt?.getTime() ?? 0,
        );
        const warning = user.inactivityWarningSentAt?.getTime();
        if (
          !warning ||
          activity > inactivity.cutoff.getTime() ||
          warning > inactivity.warningCutoff.getTime() ||
          activity > warning
        )
          return;
      }
      // Preserve only reported messages as restricted moderation evidence.
      await manager.query(
        `UPDATE reports r SET "retainedEvidence" = COALESCE(
        r."retainedEvidence", jsonb_build_object('messageId', m.id,
        'content', m.content, 'sentAt', m."createdAt"))
        FROM messages m JOIN chats c ON m."chatId" = c.id
        JOIN matches mt ON c."matchId" = mt.id
        WHERE r."messageId" = m.id AND (mt."user1Id" = $1 OR mt."user2Id" = $1)`,
        [userId],
      );
      const photos: { url: string }[] = await manager.query(
        'SELECT ph.url FROM photos ph JOIN profiles p ON ph."profileId" = p.id WHERE p."userId" = $1',
        [userId],
      );
      const exports: { fileUrl: string }[] = await manager.query(
        'SELECT "fileUrl" FROM data_export_requests WHERE "userId" = $1 AND "fileUrl" IS NOT NULL',
        [userId],
      );
      // A storage failure rolls back the database deletion, allowing a retry.
      for (const photo of photos)
        await this.storageService.deleteFile(photo.url, true);
      for (const file of exports)
        await this.storageService.deletePrivateExport(file.fileUrl);
      await manager.query(
        `UPDATE daily_selections SET
        "selectedProfileIds" = ARRAY(SELECT unnest(array_remove("selectedProfileIds", $1::uuid)) EXCEPT SELECT id FROM profiles WHERE "userId" = $1),
        "chosenProfileIds" = ARRAY(SELECT unnest(array_remove("chosenProfileIds", $1::uuid)) EXCEPT SELECT id FROM profiles WHERE "userId" = $1)
        WHERE "userId" <> $1`,
        [userId],
      );
      // Les tickets support ne sont plus supprimés explicitement ici : la
      // FK support_tickets.userId est passée à onDelete: 'SET NULL' (voir
      // migration AddSetNullRetentionForeignKeys) pour que le ticket
      // survive 12 mois après clôture, conformément à la politique de
      // rétention (docs/DATA_RETENTION_POLICY.md). Il sera anonymisé
      // (userId = NULL) automatiquement par la suppression du User
      // ci-dessous, puis purgé par RetentionScheduler.purgeClosedSupportTickets.
      await manager
        .createQueryBuilder()
        .delete()
        .from('feedback')
        .where('"userId" = :userId', { userId })
        .execute();
      // Keep only actual payment references, never a RevenueCat profile or arbitrary metadata.
      await manager.query(
        `DELETE FROM subscriptions WHERE "userId" = $1
        AND "originalTransactionId" IS NULL AND (price IS NULL OR price = 0)`,
        [userId],
      );
      await manager.query(
        `UPDATE subscriptions SET "revenueCatCustomerId" = NULL,
        metadata = NULL WHERE "userId" = $1`,
        [userId],
      );
      await manager.delete(User, { id: userId });
      // Minimal deletion ledger for replay after restoring a backup. Voluntary
      // requests already have a ledger entry; inactivity/direct erasure may not.
      await manager.query(
        `INSERT INTO account_deletions ("userId", status, "requestedAt", "completedAt")
        SELECT $1::uuid, 'completed', NOW(), NOW() WHERE NOT EXISTS
        (SELECT 1 FROM account_deletions WHERE "userId" = $1
          AND status IN ('pending', 'processing', 'completed'))`,
        [userId],
      );
    });

    this.logger.log(`Complete deletion finished for user ${userId}`);
  }

  // Sanitization methods to clean sensitive data for export
  private sanitizeUserData(user: User | null): Record<string, unknown> | null {
    if (!user) return null;
    // Remove sensitive fields before export
    const safeData: Record<string, unknown> = { ...user };
    delete safeData.passwordHash;
    delete safeData.emailVerificationToken;
    delete safeData.resetPasswordToken;
    return safeData;
  }

  private sanitizeProfileData(profile: Profile | null) {
    return profile
      ? {
          id: profile.id,
          firstName: profile.firstName,
          birthDate: profile.birthDate,
          location: profile.location,
          bio: profile.bio,
          interests: profile.interests,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        }
      : null;
  }

  private sanitizeMatchData(match: Match, userId: string) {
    return {
      id: match.id,
      matchedWith: match.user1Id === userId ? match.user2Id : match.user1Id,
      matchedAt: match.createdAt,
      status: match.status,
    };
  }

  private sanitizeMessageData(message: Message) {
    return {
      id: message.id,
      content: message.content,
      sentAt: message.createdAt,
      chatId: message.chatId,
    };
  }

  private sanitizeSubscriptionData(subscription: Subscription) {
    return {
      id: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      startDate: subscription.startDate,
      expiresAt: subscription.expiresAt,
      createdAt: subscription.createdAt,
    };
  }

  private sanitizeDailySelectionData(selection: DailySelection) {
    return {
      id: selection.id,
      selectionDate: selection.selectionDate,
      selectedProfileIds: selection.selectedProfileIds,
      chosenProfileIds: selection.chosenProfileIds,
      choicesUsed: selection.choicesUsed,
      createdAt: selection.createdAt,
    };
  }

  private sanitizeConsentData(consent: UserConsent) {
    return {
      id: consent.id,
      dataProcessing: consent.dataProcessing,
      marketing: consent.marketing,
      analytics: consent.analytics,
      consentedAt: consent.consentedAt,
      revokedAt: consent.revokedAt,
      isActive: consent.isActive,
      createdAt: consent.createdAt,
    };
  }

  private sanitizePushTokenData(token: PushToken) {
    return {
      id: token.id,
      platform: token.platform,
      isActive: token.isActive,
      createdAt: token.createdAt,
    };
  }

  private sanitizeNotificationData(notification: Notification) {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    };
  }

  private sanitizeReportData(report: Report) {
    return {
      id: report.id,
      type: report.type,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt,
    };
  }
}
