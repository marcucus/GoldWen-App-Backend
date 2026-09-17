import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { CustomLoggerService } from '../../common/logger';
import { NotificationConfig } from '../../config/config.interface';

export interface FirebaseNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface FirebaseSendResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
}

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app: admin.app.App | null = null;
  private initialized = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: CustomLoggerService,
  ) {}

  onModuleInit() {
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) {
      return;
    }

    try {
      const firebaseConfig = this.configService.get<
        NotificationConfig['firebase']
      >('notification.firebase');

      if (!firebaseConfig) {
        this.logger.warn(
          'Firebase configuration not found, Firebase notifications will be disabled',
          'FirebaseService',
        );
        return;
      }

      // Try to initialize with service account file path first
      if (firebaseConfig.serviceAccountPath) {
        try {
          // The service account path is an operator-provided filesystem
          // path resolved at startup, not a bundled module — a dynamic
          // `import()` would need JSON import assertions and still be just
          // as dynamic, so `require()` remains the right tool here.
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const serviceAccount = require(
            firebaseConfig.serviceAccountPath,
          ) as admin.ServiceAccount;
          this.app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
          this.initialized = true;
          this.logger.info(
            'Firebase Admin SDK initialized with service account file',
            'FirebaseService',
          );
          return;
        } catch (error: unknown) {
          this.logger.warn(
            `Failed to load service account from path: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`,
            'FirebaseService',
          );
        }
      }

      // Try to initialize with individual credentials
      if (
        firebaseConfig.projectId &&
        firebaseConfig.clientEmail &&
        firebaseConfig.privateKey
      ) {
        this.app = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: firebaseConfig.projectId,
            clientEmail: firebaseConfig.clientEmail,
            privateKey: firebaseConfig.privateKey,
          }),
        });
        this.initialized = true;
        this.logger.info(
          'Firebase Admin SDK initialized with environment credentials',
          'FirebaseService',
        );
        return;
      }

      this.logger.warn(
        'Firebase credentials not configured, Firebase notifications will be disabled',
        'FirebaseService',
      );
    } catch (error: unknown) {
      this.logger.error(
        'Failed to initialize Firebase Admin SDK',
        error instanceof Error ? error.stack : String(error),
        'FirebaseService',
      );
    }
  }

  async sendToDevice(
    deviceToken: string,
    payload: FirebaseNotificationPayload,
  ): Promise<FirebaseSendResponse> {
    if (!this.initialized || !this.app) {
      this.logger.warn(
        'Firebase not initialized, skipping push notification',
        'FirebaseService',
      );
      return {
        success: false,
        error: 'Firebase not initialized',
        errorCode: 'NOT_INITIALIZED',
      };
    }

    if (!deviceToken) {
      this.logger.warn(
        'No device token provided for push notification',
        'FirebaseService',
      );
      return {
        success: false,
        error: 'No device token',
        errorCode: 'MISSING_TOKEN',
      };
    }

    try {
      // Convert all data values to strings as required by FCM
      const stringData: Record<string, string> = {};
      if (payload.data) {
        Object.entries(payload.data).forEach(([key, value]) => {
          stringData[key] = String(value);
        });
      }

      const message: admin.messaging.Message = {
        token: deviceToken,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: stringData,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            priority: 'high',
            channelId: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              contentAvailable: true,
            },
          },
        },
      };

      const messageId = await admin.messaging().send(message);

      this.logger.info('Firebase push notification sent successfully', {
        messageId,
        deviceToken: deviceToken.substring(0, 10) + '...',
        title: payload.title,
      });

      return {
        success: true,
        messageId,
      };
    } catch (error: unknown) {
      // Extract error code for better handling
      const firebaseError = error as { code?: string; message?: string };
      const errorCode = firebaseError.code || 'UNKNOWN';
      const errorMessage = firebaseError.message || 'Unknown error';

      this.logger.error(
        'Failed to send Firebase push notification',
        `${errorCode}: ${errorMessage}`,
        'FirebaseService',
      );

      return {
        success: false,
        error: errorMessage,
        errorCode,
      };
    }
  }

  async sendToMultipleDevices(
    deviceTokens: string[],
    payload: FirebaseNotificationPayload,
  ): Promise<FirebaseSendResponse[]> {
    if (!this.initialized || !this.app) {
      this.logger.warn(
        'Firebase not initialized, skipping batch push notifications',
        'FirebaseService',
      );
      return deviceTokens.map(() => ({
        success: false,
        error: 'Firebase not initialized',
        errorCode: 'NOT_INITIALIZED',
      }));
    }

    const results = await Promise.all(
      deviceTokens.map((token) => this.sendToDevice(token, payload)),
    );

    const successCount = results.filter((r) => r.success).length;

    this.logger.info('Firebase batch push notifications completed', {
      total: deviceTokens.length,
      successful: successCount,
      failed: deviceTokens.length - successCount,
    });

    return results;
  }

  async sendToTopic(
    topic: string,
    payload: FirebaseNotificationPayload,
  ): Promise<FirebaseSendResponse> {
    if (!this.initialized || !this.app) {
      this.logger.warn(
        'Firebase not initialized, skipping topic notification',
        'FirebaseService',
      );
      return {
        success: false,
        error: 'Firebase not initialized',
        errorCode: 'NOT_INITIALIZED',
      };
    }

    try {
      // Convert all data values to strings as required by FCM
      const stringData: Record<string, string> = {};
      if (payload.data) {
        Object.entries(payload.data).forEach(([key, value]) => {
          stringData[key] = String(value);
        });
      }

      const message: admin.messaging.Message = {
        topic,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: stringData,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              contentAvailable: true,
            },
          },
        },
      };

      const messageId = await admin.messaging().send(message);

      this.logger.info('Firebase topic notification sent successfully', {
        topic,
        messageId,
        title: payload.title,
      });

      return {
        success: true,
        messageId,
      };
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message?: string };
      const errorCode = firebaseError.code || 'UNKNOWN';
      const errorMessage = firebaseError.message || 'Unknown error';

      this.logger.error(
        'Failed to send Firebase topic notification',
        `${errorCode}: ${errorMessage}`,
        'FirebaseService',
      );

      return {
        success: false,
        error: errorMessage,
        errorCode,
      };
    }
  }

  /**
   * Check if a Firebase error indicates an invalid or unregistered token
   */
  isInvalidTokenError(errorCode?: string): boolean {
    if (!errorCode) return false;

    const invalidTokenCodes = [
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
      'messaging/invalid-argument',
    ];

    return invalidTokenCodes.includes(errorCode);
  }

  /**
   * Get the Firebase Admin app instance
   */
  getApp(): admin.app.App | null {
    return this.app;
  }

  /**
   * Check if Firebase is initialized and ready
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
