import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { CustomLoggerService } from '../../common/logger';
import { User } from '../../database/entities/user.entity';
import { Message } from '../../database/entities/message.entity';
import { Notification } from '../../database/entities/notification.entity';

const INACTIVE_ACCOUNT_YEARS = 2;
const MESSAGE_RETENTION_MONTHS = 6;
const NOTIFICATION_RETENTION_MONTHS = 3;

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

@Injectable()
export class RetentionScheduler {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly logger: CustomLoggerService,
  ) {}

  /** Runs daily at 03:00 UTC — after nightly backup. */
  @Cron('0 3 * * *', { name: 'gdpr-data-retention', timeZone: 'UTC' })
  async runRetention() {
    const jobId = `retention-${Date.now()}`;
    this.logger.info('GDPR retention job started', { jobId });

    await Promise.allSettled([
      this.purgeInactiveAccounts(jobId),
      this.purgeOldMessages(jobId),
      this.purgeOldNotifications(jobId),
    ]);

    this.logger.info('GDPR retention job completed', { jobId });
  }

  private async purgeInactiveAccounts(jobId: string) {
    try {
      const cutoff = yearsAgo(INACTIVE_ACCOUNT_YEARS);
      const result = await this.userRepository.delete({
        lastLoginAt: LessThan(cutoff),
        isProfileCompleted: false,
      });
      this.logger.info('Purged inactive unverified accounts', {
        jobId,
        deleted: result.affected ?? 0,
        cutoff: cutoff.toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to purge inactive accounts', error.message, 'RetentionScheduler');
    }
  }

  private async purgeOldMessages(jobId: string) {
    try {
      const cutoff = monthsAgo(MESSAGE_RETENTION_MONTHS);
      const result = await this.messageRepository
        .createQueryBuilder()
        .delete()
        .where('createdAt < :cutoff', { cutoff })
        .execute();
      this.logger.info('Purged old messages', {
        jobId,
        deleted: result.affected ?? 0,
        cutoff: cutoff.toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to purge old messages', error.message, 'RetentionScheduler');
    }
  }

  private async purgeOldNotifications(jobId: string) {
    try {
      const cutoff = monthsAgo(NOTIFICATION_RETENTION_MONTHS);
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
    } catch (error) {
      this.logger.error('Failed to purge old notifications', error.message, 'RetentionScheduler');
    }
  }
}
