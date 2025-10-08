import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomLoggerService } from '../../common/logger';
import { SubscriptionsService } from './subscriptions.service';
import { RevenueCatWebhookDto } from './dto/subscription.dto';
import * as crypto from 'crypto';

@Injectable()
export class RevenueCatService {
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly logger: CustomLoggerService,
  ) {
    this.webhookSecret =
      this.configService.get<string>('revenueCat.webhookSecret') || '';
  }

  /**
   * Verify RevenueCat webhook signature
   * @param signature The signature from the X-RevenueCat-Signature header
   * @param rawBody The raw request body
   * @returns True if signature is valid
   */
  verifyWebhookSignature(signature: string, rawBody: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn(
        'RevenueCat webhook secret not configured',
        'RevenueCatService',
      );
      // In development, allow webhooks without signature verification
      if (this.configService.get('app.environment') === 'development') {
        return true;
      }
      return false;
    }

    try {
      const hmac = crypto.createHmac('sha256', this.webhookSecret);
      hmac.update(rawBody);
      const expectedSignature = hmac.digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch (error) {
      this.logger.error(
        'Error verifying webhook signature',
        error.stack,
        'RevenueCatService',
      );
      return false;
    }
  }

  /**
   * Process RevenueCat webhook event
   * @param webhookData The webhook payload
   */
  async processWebhook(webhookData: RevenueCatWebhookDto): Promise<void> {
    const { event, app_user_id: userId } = webhookData;

    this.logger.info('Processing RevenueCat webhook', {
      eventType: event.type,
      userId,
      eventId: event.id,
    });

    try {
      await this.subscriptionsService.handleRevenueCatWebhook(webhookData);

      this.logger.logBusinessEvent('revenuecat_webhook_processed', {
        eventType: event.type,
        userId,
        eventId: event.id,
      });
    } catch (error) {
      this.logger.error(
        `Error processing RevenueCat webhook: ${error.message}`,
        error.stack,
        'RevenueCatService',
      );
      throw error;
    }
  }

  /**
   * Get available subscription offerings
   * Returns the available subscription plans that can be purchased
   */
  async getOfferings(): Promise<{
    offerings: Array<{
      identifier: string;
      packages: Array<{
        identifier: string;
        platform_product_identifier: string;
      }>;
    }>;
  }> {
    // Get the plans from subscriptions service
    const { plans } = this.subscriptionsService.getPlans();

    // Transform to RevenueCat offerings format
    const offerings = [
      {
        identifier: 'default',
        packages: plans.map((plan) => ({
          identifier: plan.duration,
          platform_product_identifier: plan.id,
        })),
      },
    ];

    this.logger.info('Retrieved RevenueCat offerings', {
      offeringsCount: offerings.length,
      packagesCount: offerings[0].packages.length,
    });

    return { offerings };
  }

  /**
   * Get subscription status for a user
   * @param userId The user ID
   */
  async getSubscriptionStatus(userId: string): Promise<{
    active: boolean;
    plan?: string;
    expiresAt?: Date;
    willRenew: boolean;
    platform?: string;
  }> {
    try {
      const subscription =
        await this.subscriptionsService.getActiveSubscription(userId);

      if (!subscription) {
        return {
          active: false,
          willRenew: false,
        };
      }

      const willRenew =
        subscription.status === 'active' && !subscription.cancelledAt;

      this.logger.info('Retrieved subscription status', {
        userId,
        active: subscription.isActive,
        plan: subscription.plan,
      });

      return {
        active: subscription.isActive,
        plan: subscription.plan,
        expiresAt: subscription.expiresAt,
        willRenew,
        platform: subscription.platform,
      };
    } catch (error) {
      this.logger.error(
        `Error getting subscription status: ${error.message}`,
        error.stack,
        'RevenueCatService',
      );
      throw error;
    }
  }
}
