import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DataExportRequest,
  ExportStatus,
  ExportFormat,
} from '../../database/entities/data-export-request.entity';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { StorageService } from '../../common/services/storage.service';
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
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(
    @InjectRepository(DataExportRequest)
    private dataExportRequestRepository: Repository<DataExportRequest>,
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
    private storageService: StorageService,
    private configService: ConfigService,
  ) {}

  private signature(requestId: string, expires: string): string {
    const secret = this.configService.get<string>('jwt.secret');
    if (!secret) throw new Error('Signing secret is not configured');
    return createHmac('sha256', secret)
      .update(`gdpr-export:${requestId}:${expires}`)
      .digest('hex');
  }

  getDownloadUrl(request: DataExportRequest): string | null {
    if (
      request.status !== ExportStatus.COMPLETED ||
      !request.fileUrl ||
      !request.expiresAt ||
      request.expiresAt <= new Date()
    )
      return null;
    const expires = String(Math.floor(request.expiresAt.getTime() / 1000));
    const appUrl =
      this.configService.get<string>('app.url')?.replace(/\/$/, '') || '';
    const prefix = this.configService.get<string>('app.apiPrefix') || 'api/v1';
    return `${appUrl}/${prefix}/exports/${request.id}/download?expires=${expires}&signature=${this.signature(request.id, expires)}`;
  }

  async download(
    requestId: string,
    expires: string,
    signature: string,
  ): Promise<Buffer> {
    if (
      !/^\d+$/.test(expires) ||
      Number(expires) <= Date.now() / 1000 ||
      !/^[a-f0-9]{64}$/.test(signature)
    ) {
      throw new ForbiddenException('Invalid or expired download link');
    }
    const actual = Buffer.from(signature);
    const expected = Buffer.from(this.signature(requestId, expires));
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new ForbiddenException('Invalid download link');
    const request = await this.dataExportRequestRepository.findOne({
      where: { id: requestId },
    });
    if (
      !request ||
      request.status !== ExportStatus.COMPLETED ||
      !request.fileUrl
    )
      throw new NotFoundException('Export not found');
    if (
      !request.expiresAt ||
      request.expiresAt <= new Date() ||
      Number(expires) > request.expiresAt.getTime() / 1000
    )
      throw new ForbiddenException('Export has expired');
    return this.storageService.readPrivateExport(request.fileUrl);
  }

  /**
   * Create a new data export request
   * Art. 20 RGPD - Right to data portability
   */
  async createExportRequest(
    userId: string,
    format: ExportFormat = ExportFormat.JSON,
  ): Promise<DataExportRequest> {
    if (format !== ExportFormat.JSON)
      throw new BadRequestException('Only JSON exports are supported');
    this.logger.log(
      `Creating data export request for user ${userId} in ${format} format`,
    );

    const exportRequest = this.dataExportRequestRepository.create({
      userId,
      format,
      status: ExportStatus.PENDING,
      // Set expiration to 7 days from completion
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const savedRequest =
      await this.dataExportRequestRepository.save(exportRequest);

    // Process export asynchronously (in a real app, this would be a queue job)
    this.processExportRequest(savedRequest.id).catch((error) => {
      this.logger.error(
        `Failed to process export request ${savedRequest.id}:`,
        error,
      );
    });

    return savedRequest;
  }

  /**
   * Process an export request and generate the data file
   */
  async processExportRequest(requestId: string): Promise<void> {
    const request = await this.dataExportRequestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      this.logger.error(`Export request ${requestId} not found`);
      return;
    }

    try {
      // Update status to processing
      await this.dataExportRequestRepository.update(requestId, {
        status: ExportStatus.PROCESSING,
      });

      // Collect all user data
      const exportData = await this.collectUserData(request.userId);

      const key = `exports/${request.id}.json`;
      await this.storageService.uploadPrivateExport(
        key,
        Buffer.from(JSON.stringify(exportData)),
      );
      await this.dataExportRequestRepository.update(requestId, {
        status: ExportStatus.COMPLETED,
        completedAt: new Date(),
        fileUrl: key,
      });

      this.logger.log(`Export request ${requestId} completed successfully`);
    } catch (error: unknown) {
      this.logger.error(`Error processing export request ${requestId}:`, error);
      const errorMessage =
        error instanceof Error
          ? error instanceof Error
            ? error.message
            : String(error)
          : 'Unknown error';
      await this.dataExportRequestRepository.update(requestId, {
        status: ExportStatus.FAILED,
        errorMessage,
      });
    }
  }

  /**
   * Get export request by ID
   */
  async getExportRequest(
    userId: string,
    requestId: string,
  ): Promise<DataExportRequest | null> {
    return this.dataExportRequestRepository.findOne({
      where: { id: requestId, userId },
    });
  }

  /**
   * Get all export requests for a user
   */
  async getUserExportRequests(userId: string): Promise<DataExportRequest[]> {
    return this.dataExportRequestRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Purge des exports expirés (Art. 20 RGPD — fichier disponible 7 jours,
   * voir EXPORT_FILE_RETENTION_DAYS). Supprime le fichier du stockage et
   * efface la référence en base ; appelé par RetentionScheduler.
   */
  async purgeExpiredExports(): Promise<number> {
    const expired = await this.dataExportRequestRepository
      .createQueryBuilder('export')
      .where('export.expiresAt IS NOT NULL')
      .andWhere('export.expiresAt < :now', { now: new Date() })
      .andWhere('export.fileUrl IS NOT NULL')
      .getMany();

    let purged = 0;
    for (const request of expired) {
      try {
        if (request.fileUrl) {
          await this.storageService.deletePrivateExport(request.fileUrl);
        }
        await this.dataExportRequestRepository.update(request.id, {
          // Raw SQL NULL: TypeORM silently skips `undefined` values on
          // update(), so this is the only way to actually clear the column.
          fileUrl: () => 'NULL',
        });
        purged++;
      } catch (error: unknown) {
        this.logger.error(
          `Failed to purge expired export ${request.id}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    return purged;
  }

  /**
   * Collect all user data from different entities
   * Art. 20 RGPD - Complete data export
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
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        userId: userId,
        dataCategories: [
          'user',
          'profile',
          'matches',
          'messages',
          'subscriptions',
          'dailySelections',
          'consents',
          'pushTokens',
          'notifications',
          'reports',
        ],
      },
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

  // Sanitization methods
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
