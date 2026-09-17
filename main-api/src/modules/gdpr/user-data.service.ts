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
  ) {}

  /**
   * Export all user data in a structured format
   */
  async exportUserData(userId: string, format: 'json' | 'pdf' = 'json') {
    if (format !== 'json') throw new BadRequestException('Only JSON exports are supported');
    this.logger.log(
      `Starting data export for user ${userId} in ${format} format`,
    );

    // Get all user data
    const userData = await this.collectUserData(userId);

    if (format === 'json') {
      return {
        exportedAt: new Date().toISOString(),
        userId: userId,
        data: userData,
      };
    }

    // For PDF format, we would need a PDF generation library
    // For now, return JSON format with PDF indication
    return {
      exportedAt: new Date().toISOString(),
      userId: userId,
      format: 'json', // Would be 'pdf' with proper implementation
      data: userData,
      note: 'PDF export requires additional implementation with PDF generation library',
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
  async deleteUserCompletely(userId: string): Promise<void> {
    this.logger.log(`Starting complete deletion for user ${userId}`);

    await this.userRepository.manager.transaction(async (manager) => {
      // Remove reports that reference a chat being erased, including reports by third parties.
      await manager.createQueryBuilder().delete().from('reports')
        .where(`"chatId" IN (SELECT chats.id FROM chats JOIN matches ON chats."matchId" = matches.id
          WHERE matches."user1Id" = :userId OR matches."user2Id" = :userId)
          OR "messageId" IN (SELECT messages.id FROM messages JOIN chats ON messages."chatId" = chats.id
          JOIN matches ON chats."matchId" = matches.id
          WHERE matches."user1Id" = :userId OR matches."user2Id" = :userId)`, { userId }).execute();
      await manager.createQueryBuilder().delete().from('support_tickets').where('"userId" = :userId', { userId }).execute();
      await manager.createQueryBuilder().delete().from('feedback').where('"userId" = :userId', { userId }).execute();
      await manager.delete(User, { id: userId });
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
