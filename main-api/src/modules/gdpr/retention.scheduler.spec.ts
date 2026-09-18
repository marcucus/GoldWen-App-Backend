import { UserDataService } from './user-data.service';
import { EmailService } from '../email/email.service';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { RetentionScheduler } from './retention.scheduler';
import { NotificationsService } from '../notifications/notifications.service';
import { DataExportService } from './data-export.service';
import { CustomLoggerService } from '../../common/logger';
import { User } from '../../database/entities/user.entity';
import { Notification } from '../../database/entities/notification.entity';
import { DailySelection } from '../../database/entities/daily-selection.entity';
import { Report } from '../../database/entities/report.entity';
import { SupportTicket } from '../../database/entities/support-ticket.entity';
import { Subscription } from '../../database/entities/subscription.entity';

function makeQueryBuilder(overrides: Record<string, unknown> = {}) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
    ...overrides,
  };
}

describe('RetentionScheduler', () => {
  let scheduler: RetentionScheduler;

  const mockUserRepository = {
    createQueryBuilder: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const mockNotificationRepository = {
    createQueryBuilder: jest.fn(),
  };
  const mockDailySelectionRepository = {
    createQueryBuilder: jest.fn(),
  };
  const mockReportRepository = {
    createQueryBuilder: jest.fn(),
  };
  const mockSupportTicketRepository = {
    createQueryBuilder: jest.fn(),
  };
  const mockSubscriptionRepository = {
    createQueryBuilder: jest.fn(),
  };
  const mockUserDataService = { deleteUserCompletely: jest.fn() };
  const mockEmailService = {
    sendOperationalEmail: jest.fn().mockResolvedValue(undefined),
  };
  const mockNotificationsService = {
    sendAccountInactivityWarningNotification: jest.fn(),
  };
  const mockDataExportService = {
    purgeExpiredExports: jest.fn(),
  };
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionScheduler,
        { provide: UserDataService, useValue: mockUserDataService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepository,
        },
        {
          provide: getRepositoryToken(DailySelection),
          useValue: mockDailySelectionRepository,
        },
        {
          provide: getRepositoryToken(Report),
          useValue: mockReportRepository,
        },
        {
          provide: getRepositoryToken(SupportTicket),
          useValue: mockSupportTicketRepository,
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: mockSubscriptionRepository,
        },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: DataExportService, useValue: mockDataExportService },
        { provide: CustomLoggerService, useValue: mockLogger },
      ],
    }).compile();

    scheduler = module.get<RetentionScheduler>(RetentionScheduler);

    // Sensible defaults so a job that isn't the focus of a given test
    // doesn't blow up on an unmocked call.
    mockUserRepository.createQueryBuilder.mockReturnValue(makeQueryBuilder());
    mockNotificationRepository.createQueryBuilder.mockReturnValue(
      makeQueryBuilder(),
    );
    mockDailySelectionRepository.createQueryBuilder.mockReturnValue(
      makeQueryBuilder(),
    );
    mockReportRepository.createQueryBuilder.mockReturnValue(makeQueryBuilder());
    mockSupportTicketRepository.createQueryBuilder.mockReturnValue(
      makeQueryBuilder(),
    );
    mockSubscriptionRepository.createQueryBuilder.mockReturnValue(
      makeQueryBuilder(),
    );
    mockDataExportService.purgeExpiredExports.mockResolvedValue(0);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('runRetention', () => {
    it('runs every purge job and logs completion even if one fails', async () => {
      mockNotificationRepository.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({
          execute: jest.fn().mockRejectedValue(new Error('db down')),
        }),
      );

      await scheduler.runRetention();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'GDPR retention job started',
        expect.any(Object),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'GDPR retention job completed',
        expect.any(Object),
      );
      expect(mockDataExportService.purgeExpiredExports).toHaveBeenCalled();
    });
  });

  describe('warnInactiveAccounts (via runRetention)', () => {
    it('sends a warning and stamps inactivityWarningSentAt for each user due', async () => {
      const usersToWarn = [
        { id: 'user-1', email: 'a@example.test' },
        { id: 'user-2', email: 'b@example.test' },
      ];
      mockUserRepository.createQueryBuilder.mockReturnValueOnce(
        makeQueryBuilder({ getMany: jest.fn().mockResolvedValue(usersToWarn) }),
      );
      mockUserRepository.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({ getMany: jest.fn().mockResolvedValue([]) }),
      );
      mockNotificationsService.sendAccountInactivityWarningNotification.mockResolvedValue(
        undefined,
      );
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      await scheduler.runRetention();

      expect(
        mockNotificationsService.sendAccountInactivityWarningNotification,
      ).toHaveBeenCalledWith('user-1', 30);
      expect(
        mockNotificationsService.sendAccountInactivityWarningNotification,
      ).toHaveBeenCalledWith('user-2', 30);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-1', {
        inactivityWarningSentAt: expect.any(Date),
      });
    });

    it('never stamps a warning when operational email delivery fails', async () => {
      mockUserRepository.createQueryBuilder.mockReturnValueOnce(
        makeQueryBuilder({
          getMany: jest
            .fn()
            .mockResolvedValue([{ id: 'user-1', email: 'a@example.test' }]),
        }),
      );
      mockEmailService.sendOperationalEmail.mockRejectedValueOnce(
        new Error('SMTP unavailable'),
      );
      await scheduler.runRetention();
      expect(mockUserRepository.update).not.toHaveBeenCalled();
      expect(
        mockNotificationsService.sendAccountInactivityWarningNotification,
      ).not.toHaveBeenCalled();
    });

    it('does not stop other warnings when sending one notification fails', async () => {
      const usersToWarn = [
        { id: 'user-1', email: 'a@example.test' },
        { id: 'user-2', email: 'b@example.test' },
      ];
      mockUserRepository.createQueryBuilder.mockReturnValueOnce(
        makeQueryBuilder({ getMany: jest.fn().mockResolvedValue(usersToWarn) }),
      );
      mockUserRepository.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({ getMany: jest.fn().mockResolvedValue([]) }),
      );
      mockNotificationsService.sendAccountInactivityWarningNotification
        .mockRejectedValueOnce(new Error('push failed'))
        .mockResolvedValueOnce(undefined);
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      await scheduler.runRetention();

      expect(
        mockNotificationsService.sendAccountInactivityWarningNotification,
      ).toHaveBeenCalledTimes(2);
      // Only the successful one gets stamped.
      expect(mockUserRepository.update).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-2', {
        inactivityWarningSentAt: expect.any(Date),
      });
    });
  });

  describe('purgeInactiveAccounts (via runRetention)', () => {
    it('hard-deletes users whose inactivity warning is due and still valid', async () => {
      const usersToDelete = [{ id: 'user-3' }];
      // First createQueryBuilder call is warnInactiveAccounts (empty),
      // second is purgeInactiveAccounts.
      mockUserRepository.createQueryBuilder
        .mockReturnValueOnce(
          makeQueryBuilder({ getMany: jest.fn().mockResolvedValue([]) }),
        )
        .mockReturnValueOnce(
          makeQueryBuilder({
            getMany: jest.fn().mockResolvedValue(usersToDelete),
          }),
        );
      mockUserRepository.delete.mockResolvedValue({ affected: 1 });

      await scheduler.runRetention();

      expect(mockUserDataService.deleteUserCompletely).toHaveBeenCalledWith(
        'user-3',
        { cutoff: expect.any(Date), warningCutoff: expect.any(Date) },
      );
    });
  });

  describe('purgeOldNotifications (via runRetention)', () => {
    it('deletes notifications older than the retention window', async () => {
      const execute = jest.fn().mockResolvedValue({ affected: 42 });
      mockNotificationRepository.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({ execute }),
      );

      await scheduler.runRetention();

      expect(execute).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Purged old notifications',
        expect.objectContaining({ deleted: 42 }),
      );
    });
  });

  describe('purgeOldDailySelections (via runRetention)', () => {
    it('deletes daily selections older than 90 days', async () => {
      const execute = jest.fn().mockResolvedValue({ affected: 7 });
      mockDailySelectionRepository.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({ execute }),
      );

      await scheduler.runRetention();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Purged old daily selections',
        expect.objectContaining({ deleted: 7 }),
      );
    });
  });

  describe('purgeClosedReports (via runRetention)', () => {
    it('deletes closed reports older than 12 months', async () => {
      const execute = jest.fn().mockResolvedValue({ affected: 2 });
      mockReportRepository.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({ execute }),
      );

      await scheduler.runRetention();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Purged closed reports',
        expect.objectContaining({ deleted: 2 }),
      );
    });
  });

  describe('purgeClosedSupportTickets (via runRetention)', () => {
    it('deletes closed support tickets older than 12 months', async () => {
      const execute = jest.fn().mockResolvedValue({ affected: 1 });
      mockSupportTicketRepository.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({ execute }),
      );

      await scheduler.runRetention();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Purged closed support tickets',
        expect.objectContaining({ deleted: 1 }),
      );
    });
  });

  describe('purgeOldAnonymizedSubscriptions (via runRetention)', () => {
    it('deletes anonymized subscriptions older than the accounting retention window', async () => {
      const execute = jest.fn().mockResolvedValue({ affected: 5 });
      mockSubscriptionRepository.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({ execute }),
      );

      await scheduler.runRetention();

      expect(execute).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Purged old anonymized subscriptions',
        expect.objectContaining({ deleted: 5 }),
      );
    });

    it('logs an error without throwing when the subscription purge fails', async () => {
      mockSubscriptionRepository.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({
          execute: jest.fn().mockRejectedValue(new Error('db down')),
        }),
      );

      await expect(scheduler.runRetention()).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to purge old anonymized subscriptions',
        'db down',
        'RetentionScheduler',
      );
    });
  });

  describe('purgeExpiredExports (via runRetention)', () => {
    it('delegates to DataExportService and logs the result', async () => {
      mockDataExportService.purgeExpiredExports.mockResolvedValue(3);

      await scheduler.runRetention();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Purged expired data exports',
        expect.objectContaining({ purged: 3 }),
      );
    });

    it('logs an error without throwing when the export purge fails', async () => {
      mockDataExportService.purgeExpiredExports.mockRejectedValue(
        new Error('storage unreachable'),
      );

      await expect(scheduler.runRetention()).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to purge expired data exports',
        'storage unreachable',
        'RetentionScheduler',
      );
    });
  });
});
