import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SentryService } from './sentry.service';
import { AlertingService } from './alerting.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SentryService, AlertingService],
  exports: [SentryService, AlertingService],
})
export class MonitoringModule {}