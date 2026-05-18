import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { SentryService } from './sentry.service';
import { AlertingService } from './alerting.service';
import { DatadogService } from './datadog.service';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { AdminGuard } from '../../modules/auth/guards/admin.guard';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SentryService, AlertingService, DatadogService, MetricsService, AdminGuard, Reflector],
  controllers: [MetricsController],
  exports: [SentryService, AlertingService, DatadogService, MetricsService],
})
export class MonitoringModule {}
