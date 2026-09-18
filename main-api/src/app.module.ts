import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

// Logger
import { LoggerModule, LoggingMiddleware } from './common/logger';

// Monitoring
import { MonitoringModule } from './common/monitoring';

// Middleware
import { SecurityLoggingMiddleware } from './common/middleware';

// Guards
import { RateLimitGuard } from './common/guards';
import { ConsentGuard } from './modules/auth/guards/consent.guard';
import { UserConsent } from './database/entities/user-consent.entity';

// Configuration
import {
  databaseConfig,
  redisConfig,
  jwtConfig,
  appConfig,
  oauthConfig,
  fileUploadConfig,
  storageConfig,
  notificationConfig,
  emailConfig,
  matchingServiceConfig,
  revenueCatConfig,
  monitoringConfig,
  throttlerConfig,
  moderationConfig,
  analyticsConfig,
} from './config/configuration';
import { validateEnvironment } from './config/environment.validation';
import { StorageService } from './common/services/storage.service';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { MatchingModule } from './modules/matching/matching.module';
import { ChatModule } from './modules/chat/chat.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PreferencesModule } from './modules/preferences/preferences.module';
import { AdminModule } from './modules/admin/admin.module';
import { ReportsModule } from './modules/reports/reports.module';
import { StatsModule } from './modules/stats/stats.module';
import { EmailModule } from './modules/email/email.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { GdprModule } from './modules/gdpr/gdpr.module';
import { CronJobsModule } from './modules/cron-jobs/cron-jobs.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { LegalModule } from './modules/legal/legal.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AnalyticsMiddleware } from './modules/analytics/analytics.middleware';

@Module({
  imports: [
    // Logger - Global module
    LoggerModule,
    TypeOrmModule.forFeature([UserConsent]),

    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      load: [
        databaseConfig,
        redisConfig,
        jwtConfig,
        appConfig,
        oauthConfig,
        fileUploadConfig,
        storageConfig,
        notificationConfig,
        emailConfig,
        matchingServiceConfig,
        revenueCatConfig,
        monitoringConfig,
        throttlerConfig,
        moderationConfig,
        analyticsConfig,
      ],
    }),

    // Throttler — Redis-backed for multi-instance rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const ttl = configService.get<number>('throttler.global.ttl') || 60000;
        const limit =
          configService.get<number>('throttler.global.limit') || 100;
        const redisHost =
          configService.get<string>('redis.host') || 'localhost';
        const redisPort = configService.get<number>('redis.port') || 6379;
        const redisPassword = configService.get<string | undefined>(
          'redis.password',
        );

        return {
          throttlers: [{ name: 'default', ttl, limit }],
          storage: new ThrottlerStorageRedisService({
            host: redisHost,
            port: redisPort,
            password: redisPassword || undefined,
          }),
        };
      },
      inject: [ConfigService],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        autoLoadEntities: true,
        synchronize:
          configService.get<string>('app.environment') === 'development',
        migrationsRun:
          configService.get<string>('app.environment') !== 'development',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        logging: configService.get<string>('app.environment') === 'development',
      }),
      inject: [ConfigService],
    }),

    // Redis for application use (separate from Bull queues)
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url: `redis://${configService.get<string>('redis.host')}:${configService.get<number>('redis.port')}`,
        options: {
          password: configService.get('redis.password') || undefined,
        },
      }),
      inject: [ConfigService],
    }),

    // Schedule for cron jobs
    ScheduleModule.forRoot(),

    // Global modules
    LoggerModule,
    MonitoringModule,

    // Feature modules
    EmailModule,
    AuthModule,
    UsersModule,
    ProfilesModule,
    MatchingModule,
    ChatModule,
    SubscriptionsModule,
    NotificationsModule,
    PreferencesModule,
    AdminModule,
    ReportsModule,
    StatsModule,
    ModerationModule,
    GdprModule,
    CronJobsModule,
    LegalModule,
    AnalyticsModule,
    FeedbackModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    StorageService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    // SECURITY / RGPD (Phase 0.10): ConsentGuard existed (with a
    // @SkipConsentCheck() decorator already used in two places expecting
    // it) but was never actually registered anywhere, so it never ran —
    // GDPR Article 7 consent was not enforced at all. Registering it
    // globally here is the fix; NOTE for rollout: any user who signed up
    // before this guard was active and never called POST /users/consent
    // will now be blocked from authenticated routes until they do — this
    // needs either a consent backfill/migration or a forced consent screen
    // shipped in the same release as this change.
    {
      provide: APP_GUARD,
      useClass: ConsentGuard,
    },
  ],
  exports: [StorageService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*'); // Apply to all routes
    consumer.apply(SecurityLoggingMiddleware).forRoutes('*'); // Apply security logging
    // No-ops until MIXPANEL_TOKEN + MIXPANEL_ENABLED are set (AnalyticsService
    // checks both before initializing the Mixpanel client) — safe to enable
    // application-wide now, activates whenever real credentials land.
    consumer.apply(AnalyticsMiddleware).forRoutes('*');
  }
}
