import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GdprController } from './gdpr.controller';
import { StorageService } from '../../common/services/storage.service';
import { ExportDownloadController } from './export-download.controller';
import { UserDataService } from './user-data.service';
import { GdprService } from './gdpr.service';
import { DataExportService } from './data-export.service';
import { RetentionScheduler } from './retention.scheduler';

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
import { DataExportRequest } from '../../database/entities/data-export-request.entity';
import { AccountDeletion } from '../../database/entities/account-deletion.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Profile,
      Match,
      Message,
      Subscription,
      DailySelection,
      UserConsent,
      PushToken,
      Notification,
      Report,
      DataExportRequest,
      AccountDeletion,
    ]),
  ],
  controllers: [GdprController, ExportDownloadController],
  providers: [StorageService, GdprService, UserDataService, DataExportService, RetentionScheduler],
  exports: [GdprService, DataExportService],
})
export class GdprModule {}
