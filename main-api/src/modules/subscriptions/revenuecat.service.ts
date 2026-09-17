import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomLoggerService } from '../../common/logger';
import { SubscriptionsService } from './subscriptions.service';
import { RevenueCatWebhookDto } from './dto/subscription.dto';
import { SubscriptionStatus, SubscriptionPlan } from '../../common/enums';
import * as crypto from 'crypto';

@Injectable()
export class RevenueCatService {
  private readonly webhookSecret: string;

  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly logger: CustomLoggerService,
  ) {
    this.webhookSecret =
      this.configService.get<string>('revenueCat.webhookSecret') || '';
    this.apiKey = this.configService.get<string>('revenueCat.apiKey') || '';
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
      if (this.configService.get<string>('app.environment') === 'development') {
        return true;
      }
      return false;
    }

    try {
      const hmac = crypto.createHmac('sha256', this.webhookSecret);
      hmac.update(rawBody);
      const expectedSignature = hmac.digest('hex');

      const actual = Buffer.from(signature);
      const expected = Buffer.from(expectedSignature);
      return (
        actual.length === expected.length &&
        crypto.timingSafeEqual(actual, expected)
      );
    } catch (error: unknown) {
      this.logger.error(
        'Error verifying webhook signature',
        (error as Error).stack,
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
    } catch (error: unknown) {
      this.logger.error(
        `Error processing RevenueCat webhook: ${(error as Error).message}`,
        (error as Error).stack,
        'RevenueCatService',
      );
      throw error;
    }
  }

  /**
   * Get available subscription offerings
   * Returns the available subscription plans that can be purchased
   */
  getOfferings(): {
    offerings: Array<{
      identifier: string;
      packages: Array<{
        identifier: string;
        platform_product_identifier: string;
      }>;
    }>;
  } {
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
        subscription.status === SubscriptionStatus.ACTIVE &&
        subscription.cancelledAt === null;

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
    } catch (error: unknown) {
      this.logger.error(
        `Error getting subscription status: ${(error as Error).message}`,
        (error as Error).stack,
        'RevenueCatService',
      );
      throw error;
    }
  }

  /**
   * Confirms with RevenueCat's own server API that `appUserId` genuinely
   * holds an active entitlement for `productId` — SECURITY (Phase 0.4):
   * without this call, validatePurchase() below activated GoldWen Plus for
   * ANY signed-in user who simply POSTed a productId containing
   * "goldwen_plus", with no purchase or payment behind it whatsoever.
   */
  private async fetchActiveProductIds(appUserId: string): Promise<Set<string>> {
    if (!this.apiKey) {
      throw new Error('RevenueCat API key is not configured');
    }

    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `RevenueCat lookup failed with status ${response.status}`,
      );
    }

    const body = (await response.json()) as {
      subscriber?: {
        entitlements?: Record<
          string,
          { expires_date?: string | null; product_identifier?: string }
        >;
        subscriptions?: Record<
          string,
          { expires_date?: string | null; product_identifier?: string }
        >;
      };
    };

    const now = Date.now();
    const activeProductIds = new Set<string>();

    const collect = (
      entries: Record<string, { expires_date?: string | null }> | undefined,
      keyIsProductId: boolean,
    ) => {
      if (!entries) return;
      for (const [key, value] of Object.entries(entries)) {
        const notExpired =
          !value.expires_date || new Date(value.expires_date).getTime() > now;
        if (notExpired) {
          activeProductIds.add(
            keyIsProductId
              ? key
              : (value as { product_identifier?: string }).product_identifier ||
                  key,
          );
        }
      }
    };

    collect(body.subscriber?.subscriptions, true);
    collect(body.subscriber?.entitlements, false);

    return activeProductIds;
  }

  /**
   * Validate and process a purchase from the client
   * @param userId The user ID (also the RevenueCat app_user_id)
   * @param purchaseData The purchase data from the client — treated as a
   *   CLAIM to verify, never as the source of truth (Phase 0.4)
   */
  async validatePurchase(
    userId: string,
    purchaseData: {
      productId: string;
      transactionId: string;
      originalTransactionId?: string;
      purchaseToken?: string;
      price?: number;
      currency?: string;
      platform?: string;
    },
  ): Promise<{
    success: boolean;
    subscription?: any;
    message: string;
  }> {
    try {
      this.logger.info('Validating purchase', {
        userId,
        productId: purchaseData.productId,
        platform: purchaseData.platform,
      });

      const activeProductIds = await this.fetchActiveProductIds(userId);
      if (!activeProductIds.has(purchaseData.productId)) {
        this.logger.logSecurityEvent('purchase_validation_rejected', {
          userId,
          productId: purchaseData.productId,
          reason: 'no_matching_active_entitlement_at_revenuecat',
        });
        return {
          success: false,
          message: 'No matching active purchase found for this account',
        };
      }

      const plan = purchaseData.productId.includes('goldwen_plus')
        ? SubscriptionPlan.GOLDWEN_PLUS
        : SubscriptionPlan.FREE;

      const subscription = await this.subscriptionsService.createSubscription(
        userId,
        {
          plan,
          revenueCatSubscriptionId: purchaseData.transactionId,
          originalTransactionId: purchaseData.originalTransactionId,
          purchaseToken: purchaseData.purchaseToken,
          price: purchaseData.price,
          currency: purchaseData.currency,
          platform: purchaseData.platform,
        },
      );

      // Activate the subscription
      await this.subscriptionsService.activateSubscription(subscription.id);

      this.logger.logBusinessEvent('purchase_validated', {
        userId,
        productId: purchaseData.productId,
        subscriptionId: subscription.id,
      });

      return {
        success: true,
        subscription: {
          id: subscription.id,
          plan: subscription.plan,
          expiresAt: subscription.expiresAt,
          status: subscription.status,
        },
        message: 'Purchase validated and subscription activated successfully',
      };
    } catch (error: unknown) {
      this.logger.error(
        `Error validating purchase: ${(error as Error).message}`,
        (error as Error).stack,
        'RevenueCatService',
      );

      return {
        success: false,
        message: `Failed to validate purchase: ${(error as Error).message}`,
      };
    }
  }
}
