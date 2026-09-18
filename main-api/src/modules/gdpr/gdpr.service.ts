import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserStatus } from '../../common/enums';
import {
  AccountDeletion,
  DeletionStatus,
} from '../../database/entities/account-deletion.entity';
import {
  DataExportRequest,
  ExportFormat,
} from '../../database/entities/data-export-request.entity';
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
import { UserDataService } from './user-data.service';
import { DataExportService } from './data-export.service';

@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  constructor(
    @InjectRepository(AccountDeletion)
    private accountDeletionRepository: Repository<AccountDeletion>,
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
    private dataExportService: DataExportService,
    private userDataService: UserDataService,
  ) {}

  getExportDownloadUrl(request: DataExportRequest): string | null {
    return this.dataExportService.getDownloadUrl(request);
  }

  async exportUserData(userId: string, format: 'json' | 'pdf' = 'json') {
    return this.userDataService.exportUserData(userId, format);
  }

  async deleteUserCompletely(userId: string): Promise<void> {
    await this.userDataService.deleteUserCompletely(userId);
  }

  async getLatestDeletionStatus(
    userId: string,
  ): Promise<AccountDeletion | null> {
    return this.accountDeletionRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async cancelAccountDeletion(userId: string): Promise<void> {
    const request = await this.getLatestDeletionStatus(userId);
    if (!request || request.status !== DeletionStatus.PENDING) {
      throw new BadRequestException('No cancellable deletion request exists');
    }
    const result = await this.accountDeletionRepository.update(
      { id: request.id, userId, status: DeletionStatus.PENDING },
      { status: DeletionStatus.CANCELLED },
    );
    if (!result.affected)
      throw new BadRequestException('Deletion processing has already started');
    await this.userRepository.update(userId, { status: UserStatus.ACTIVE });
    await this.profileRepository.update({ userId }, { isVisible: true });
  }

  /**
   * Request data export for GDPR compliance
   * Art. 20 RGPD - Right to data portability
   */
  async requestDataExport(userId: string, format: 'json' | 'pdf' = 'json') {
    this.logger.log(
      `Data export requested for user ${userId} in format ${format}`,
    );

    const exportFormat =
      format === 'pdf' ? ExportFormat.PDF : ExportFormat.JSON;
    return this.dataExportService.createExportRequest(userId, exportFormat);
  }

  /**
   * Get data export request status
   */
  async getExportRequestStatus(userId: string, requestId: string) {
    const request = await this.dataExportService.getExportRequest(
      userId,
      requestId,
    );

    if (!request) {
      throw new NotFoundException('Export request not found');
    }

    return request;
  }

  /**
   * Get all export requests for a user
   */
  async getUserExportRequests(userId: string) {
    return this.dataExportService.getUserExportRequests(userId);
  }

  /**
   * Request account deletion
   * Art. 17 RGPD - Right to be forgotten
   */
  async requestAccountDeletion(
    userId: string,
    reason?: string,
  ): Promise<AccountDeletion> {
    this.logger.log(`Account deletion requested for user ${userId}`);

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const deletionRequest = this.accountDeletionRepository.create({
      userId,
      userEmail: user.email,
      status: DeletionStatus.PENDING,
      reason,
      requestedAt: new Date(),
    });

    const savedRequest =
      await this.accountDeletionRepository.save(deletionRequest);

    await this.profileRepository.update({ userId }, { isVisible: false });
    await this.userRepository.update(userId, { status: UserStatus.DELETED });

    // Process deletion asynchronously
    this.processDeletionRequest(savedRequest.id).catch((error) => {
      this.logger.error(
        `Failed to process deletion request ${savedRequest.id}:`,
        error,
      );
    });

    return savedRequest;
  }

  /**
   * Process account deletion with full anonymization
   * Art. 17 RGPD - Complete data erasure
   */
  async processDeletionRequest(requestId: string): Promise<void> {
    const request = await this.accountDeletionRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      this.logger.error(`Deletion request ${requestId} not found`);
      return;
    }

    try {
      // Update status to processing
      const claimed = await this.accountDeletionRepository.update(
        {
          id: requestId,
          status: In([DeletionStatus.PENDING, DeletionStatus.FAILED]),
        },
        { status: DeletionStatus.PROCESSING },
      );
      if (!claimed.affected) return;

      await this.deleteUserCompletely(request.userId);
      await this.accountDeletionRepository.update(requestId, {
        status: DeletionStatus.COMPLETED,
        completedAt: new Date(),
        userEmail: () => 'NULL',
        reason: () => 'NULL',
        metadata: () => 'NULL',
        errorMessage: () => 'NULL',
      });

      this.logger.log(`Account deletion ${requestId} completed successfully`);
    } catch (error: unknown) {
      this.logger.error(
        `Error processing deletion request ${requestId}:`,
        error,
      );
      const errorMessage =
        error instanceof Error
          ? error instanceof Error
            ? error.message
            : String(error)
          : 'Unknown error';
      await this.accountDeletionRepository.update(requestId, {
        status: DeletionStatus.FAILED,
        errorMessage,
      });
    }
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'retry-account-deletions' })
  async retryAccountDeletions(): Promise<void> {
    await this.accountDeletionRepository.update(
      {
        status: DeletionStatus.PROCESSING,
        updatedAt: LessThan(new Date(Date.now() - 3600000)),
      },
      { status: DeletionStatus.FAILED },
    );
    await this.accountDeletionRepository.delete({
      status: In([DeletionStatus.COMPLETED, DeletionStatus.CANCELLED]),
      updatedAt: LessThan(new Date(Date.now() - 30 * 86400000)),
    });
    const requests = await this.accountDeletionRepository.find({
      where: { status: In([DeletionStatus.PENDING, DeletionStatus.FAILED]) },
      take: 100,
      order: { requestedAt: 'ASC' },
    });
    for (const request of requests)
      await this.processDeletionRequest(request.id);
  }

  /**
   * Get deletion request status
   */
  async getDeletionRequestStatus(
    userId: string,
    requestId: string,
  ): Promise<AccountDeletion> {
    const request = await this.accountDeletionRepository.findOne({
      where: { id: requestId, userId },
    });

    if (!request) {
      throw new NotFoundException('Deletion request not found');
    }

    return request;
  }

  /**
   * Record user consent
   * Art. 7 RGPD - Consent management
   */
  async recordConsent(
    userId: string,
    consentData: {
      dataProcessing: boolean;
      marketing?: boolean;
      analytics?: boolean;
      consentedAt: string;
    },
  ): Promise<UserConsent> {
    // Deactivate previous consents
    await this.userConsentRepository.update(
      { userId, isActive: true },
      { isActive: false, revokedAt: new Date() },
    );

    // Create new consent record
    const consent = this.userConsentRepository.create({
      userId,
      dataProcessing: consentData.dataProcessing,
      marketing: consentData.marketing ?? false,
      analytics: consentData.analytics ?? false,
      consentedAt: new Date(consentData.consentedAt),
      isActive: true,
    });

    this.logger.log(`Consent recorded for user ${userId}`);

    return this.userConsentRepository.save(consent);
  }

  /**
   * Get current consent for a user
   */
  async getCurrentConsent(userId: string): Promise<UserConsent | null> {
    return this.userConsentRepository.findOne({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get consent history for a user
   * Art. 7 RGPD - Consent history tracking
   */
  async getConsentHistory(userId: string): Promise<UserConsent[]> {
    return this.userConsentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Revoke current consent
   */
  async revokeConsent(userId: string): Promise<void> {
    await this.userConsentRepository.update(
      { userId, isActive: true },
      { isActive: false, revokedAt: new Date() },
    );

    this.logger.log(`Consent revoked for user ${userId}`);
  }

  // Private helper methods for anonymization.
  //
  // NOTE (2026-09-17, politique de rétention) : anonymizeUserMessages et
  // anonymizeUserMatches ne sont actuellement PAS appelées.
  // UserDataService.deleteUserCompletely() fait un DELETE dur sur la ligne
  // User, et les FK onDelete: 'CASCADE' de Message/Match suppriment ces
  // lignes en cascade avant que cette anonymisation n'ait pu s'exécuter —
  // ce qui est le comportement voulu pour les messages (déjà purgés bien
  // avant par ChatScheduler) et les matches (pas de durée de rétention
  // indépendante définie pour eux dans la politique actuelle). Elles sont
  // conservées ici, non appelées, comme référence si une politique de
  // rétention propre aux matches devait un jour être définie.
  //
  // anonymizeReportsAgainstUser a été retirée : ce n'est plus nécessaire
  // depuis la migration AddSetNullRetentionForeignKeys, qui fait passer
  // reports.reportedUserId (et reporterId) à onDelete: 'SET NULL' — la
  // base de données anonymise elle-même la ligne au moment de la
  // suppression du compte, sans update applicatif, et surtout sans risque
  // de violer la contrainte de clé étrangère comme l'aurait fait l'ancien
  // update vers la valeur littérale non-UUID 'deleted-user'.

  /**
   * Anonymize user messages
   */
  private async anonymizeUserMessages(userId: string): Promise<number> {
    const result = await this.messageRepository.update(
      { senderId: userId },
      { senderId: 'deleted-user' },
    );

    return result.affected || 0;
  }

  /**
   * Anonymize user matches
   */
  private async anonymizeUserMatches(userId: string): Promise<number> {
    const result1 = await this.matchRepository.update(
      { user1Id: userId },
      { user1Id: 'deleted-user' },
    );

    const result2 = await this.matchRepository.update(
      { user2Id: userId },
      { user2Id: 'deleted-user' },
    );

    return (result1.affected || 0) + (result2.affected || 0);
  }
}
