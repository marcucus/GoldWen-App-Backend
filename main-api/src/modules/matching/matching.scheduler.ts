import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { User } from '../../database/entities/user.entity';
import { DailySelection } from '../../database/entities/daily-selection.entity';
import { CustomLoggerService } from '../../common/logger';
import { MatchingService } from './matching.service';
import { NotificationsService } from '../notifications/notifications.service';

const DEFAULT_TIMEZONE = 'Europe/Paris';

/** Returns true when the current wall-clock hour in `timezone` is 12 (noon). */
function isNoonInTimezone(timezone: string): boolean {
  try {
    const hour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      }).format(new Date()),
      10,
    );
    return hour === 12;
  } catch {
    return false;
  }
}

@Injectable()
export class MatchingScheduler {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(DailySelection)
    private dailySelectionRepository: Repository<DailySelection>,
    private matchingService: MatchingService,
    private notificationsService: NotificationsService,
    private configService: ConfigService,
    private logger: CustomLoggerService,
  ) {}

  /**
   * Runs every hour at :00.
   * Only processes users whose local time is noon, based on the timezone
   * stored in their profile. This replaces the single Paris-timezone noon cron.
   */
  @Cron('0 * * * *', {
    name: 'daily-selection-generation',
  })
  async generateDailySelectionsForAllUsers() {
    const startTime = Date.now();
    const jobId = `daily-selection-${Date.now()}`;

    this.logger.info('🕐 Hourly selection check started', {
      jobId,
      utcTime: new Date().toISOString(),
    });

    try {
      // Fetch all users with completed profiles and their profile timezone
      const users = await this.userRepository.find({
        where: { isProfileCompleted: true },
        relations: ['profile'],
      });

      // Keep only users for whom it is currently noon in their local timezone
      const usersAtNoon = users.filter((user) => {
        const tz = user.profile?.timezone ?? DEFAULT_TIMEZONE;
        return isNoonInTimezone(tz);
      });

      if (!usersAtNoon.length) {
        this.logger.debug('No users at local noon — skipping', 'MatchingScheduler');
        return;
      }

      this.logger.info('🚀 Starting daily selection generation job', {
        jobId,
        utcTime: new Date().toISOString(),
        eligibleUsers: usersAtNoon.length,
      });

      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;
      const errors: Array<{ userId: string; error: string }> = [];

      for (const user of usersAtNoon) {
        try {
          // Generate daily selection
          await this.matchingService.generateDailySelection(user.id);

          // Send push notification
          try {
            await this.notificationsService.sendDailySelectionNotification(
              user.id,
            );
          } catch (notifError) {
            // Log notification error but don't fail the whole job
            this.logger.warn(
              `Failed to send daily selection notification for user ${user.id}: ${notifError.message}`,
              'MatchingScheduler',
            );
          }

          successCount++;
        } catch (error) {
          // Check if selection already exists (not an error, just skip)
          if (error.message?.includes('already has a selection')) {
            skippedCount++;
          } else {
            errorCount++;
            errors.push({
              userId: user.id,
              error: error.message || 'Unknown error',
            });

            this.logger.error(
              `Failed to generate daily selection for user ${user.id}`,
              error.stack,
              'MatchingScheduler',
            );
          }
        }
      }

      const executionTime = Date.now() - startTime;

      this.logger.info('✅ Daily selection generation completed', {
        jobId,
        totalUsers: usersAtNoon.length,
        successCount,
        errorCount,
        skippedCount,
        executionTimeMs: executionTime,
        executionTimeSec: (executionTime / 1000).toFixed(2),
        successRate: ((successCount / users.length) * 100).toFixed(2) + '%',
      });

      // Alert if there are errors
      if (errorCount > 0) {
        const errorRate = (errorCount / usersAtNoon.length) * 100;
        const alertLevel = errorRate > 10 ? 'CRITICAL' : 'WARNING';

        this.logger.warn(
          `${alertLevel}: Daily selection generation had ${errorCount} errors (${errorRate.toFixed(2)}%). First 5 errors: ${JSON.stringify(errors.slice(0, 5))}`,
          'MatchingScheduler',
        );

        // TODO: Send alert to monitoring system (Sentry, Slack, etc.)
        // if (errorRate > 10) {
        //   await this.sendCriticalAlert('Daily selection generation failure', {
        //     errorCount,
        //     errorRate,
        //   });
        // }
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error(
        `Daily selection generation job failed catastrophically after ${executionTime}ms: ${error.message}`,
        error.stack,
        'MatchingScheduler',
      );

      // TODO: Send critical alert
      // await this.sendCriticalAlert('Daily selection generation catastrophic failure', {
      //   error: error.message,
      // });

      throw error; // Re-throw to ensure it's logged by NestJS scheduler
    }
  }

  /**
   * Clean up old daily selections at midnight
   * Keeps only the last 30 days of selections
   */
  @Cron('0 0 * * *', {
    name: 'cleanup-old-daily-selections',
    timeZone: 'Europe/Paris',
  })
  async cleanupOldDailySelections() {
    const jobId = `cleanup-selections-${Date.now()}`;
    const startTime = Date.now();

    this.logger.info('🧹 Starting daily selections cleanup job', {
      jobId,
      scheduledTime: new Date().toISOString(),
    });

    try {
      // Delete selections older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.dailySelectionRepository
        .createQueryBuilder()
        .delete()
        .where('createdAt < :date', { date: thirtyDaysAgo })
        .execute();

      const executionTime = Date.now() - startTime;

      this.logger.info('✅ Daily selections cleanup completed', {
        jobId,
        deletedCount: result.affected || 0,
        cutoffDate: thirtyDaysAgo.toISOString(),
        executionTimeMs: executionTime,
      });
    } catch (error) {
      this.logger.error(
        `Daily selections cleanup job failed: ${error.message}`,
        error.stack,
        'MatchingScheduler',
      );

      throw error;
    }
  }

  /**
   * Manual trigger for testing in development
   * Can be called from admin endpoints or for testing
   */
  async triggerDailySelectionGeneration() {
    if (this.configService.get('app.environment') === 'production') {
      throw new Error(
        'Manual trigger not allowed in production. Use scheduled jobs.',
      );
    }

    this.logger.info('Manual trigger: Daily selection generation', {
      environment: this.configService.get('app.environment'),
    });

    await this.generateDailySelectionsForAllUsers();
  }

  /**
   * Manual trigger for cleanup testing
   */
  async triggerCleanup() {
    if (this.configService.get('app.environment') === 'production') {
      throw new Error(
        'Manual trigger not allowed in production. Use scheduled jobs.',
      );
    }

    this.logger.info('Manual trigger: Daily selections cleanup', {
      environment: this.configService.get('app.environment'),
    });

    await this.cleanupOldDailySelections();
  }
}
