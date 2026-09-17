import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

import { MatchingScheduler } from '../matching.scheduler';
import { MatchingService } from '../matching.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { User } from '../../../database/entities/user.entity';
import { DailySelection } from '../../../database/entities/daily-selection.entity';
import { CustomLoggerService } from '../../../common/logger';

describe('MatchingScheduler', () => {
  let scheduler: MatchingScheduler;

  const mockUserRepository = {
    find: jest.fn(),
  };

  const mockDailySelectionRepository = {
    createQueryBuilder: jest.fn(() => ({
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 10 }),
    })),
  };

  const mockMatchingService = {
    generateDailySelection: jest.fn(),
  };

  const mockNotificationsService = {
    sendDailySelectionNotification: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string): string | undefined => {
      if (key === 'app.environment') return 'development';
      return undefined;
    }),
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
        MatchingScheduler,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(DailySelection),
          useValue: mockDailySelectionRepository,
        },
        {
          provide: MatchingService,
          useValue: mockMatchingService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CustomLoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    scheduler = module.get<MatchingScheduler>(MatchingScheduler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateDailySelectionsForAllUsers', () => {
    // The scheduler now runs hourly and only processes users for whom it is
    // currently noon in their own profile timezone (Phase 1.3 — see
    // isNoonInTimezone in matching.scheduler.ts). None of the mock users
    // below set a profile.timezone, so they fall back to DEFAULT_TIMEZONE
    // ('Europe/Paris'); pin the clock to a fixed Paris-noon instant so these
    // tests don't depend on the wall-clock time the suite happens to run at.
    beforeEach(() => {
      jest.useFakeTimers({ advanceTimers: false });
      jest.setSystemTime(new Date('2025-01-15T11:00:00.000Z')); // 12:00 in Europe/Paris (UTC+1, winter)
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should generate daily selections for all users with completed profiles', async () => {
      const mockUsers = [
        { id: 'user1', isProfileCompleted: true },
        { id: 'user2', isProfileCompleted: true },
        { id: 'user3', isProfileCompleted: true },
      ];

      mockUserRepository.find.mockResolvedValue(mockUsers);
      mockMatchingService.generateDailySelection.mockResolvedValue({
        id: 'selection1',
      });
      mockNotificationsService.sendDailySelectionNotification.mockResolvedValue(
        true,
      );

      await scheduler.generateDailySelectionsForAllUsers();

      expect(mockUserRepository.find).toHaveBeenCalledWith({
        where: { isProfileCompleted: true },
        relations: ['profile'],
      });
      expect(mockMatchingService.generateDailySelection).toHaveBeenCalledTimes(
        3,
      );
      expect(mockMatchingService.generateDailySelection).toHaveBeenCalledWith(
        'user1',
      );
      expect(mockMatchingService.generateDailySelection).toHaveBeenCalledWith(
        'user2',
      );
      expect(mockMatchingService.generateDailySelection).toHaveBeenCalledWith(
        'user3',
      );
      expect(
        mockNotificationsService.sendDailySelectionNotification,
      ).toHaveBeenCalledTimes(3);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting daily selection generation'),
        expect.any(Object),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('completed'),
        expect.objectContaining({
          successCount: 3,
          errorCount: 0,
        }),
      );
    });

    it('should handle errors gracefully and continue processing other users', async () => {
      const mockUsers = [
        { id: 'user1', isProfileCompleted: true },
        { id: 'user2', isProfileCompleted: true },
        { id: 'user3', isProfileCompleted: true },
      ];

      mockUserRepository.find.mockResolvedValue(mockUsers);
      mockMatchingService.generateDailySelection
        .mockResolvedValueOnce({ id: 'selection1' })
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({ id: 'selection3' });

      mockNotificationsService.sendDailySelectionNotification.mockResolvedValue(
        true,
      );

      await scheduler.generateDailySelectionsForAllUsers();

      expect(mockMatchingService.generateDailySelection).toHaveBeenCalledTimes(
        3,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate daily selection'),
        expect.any(String),
        'MatchingScheduler',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('completed'),
        expect.objectContaining({
          successCount: 2,
          errorCount: 1,
        }),
      );
    });

    it('should handle notification errors without failing selection generation', async () => {
      const mockUsers = [{ id: 'user1', isProfileCompleted: true }];

      mockUserRepository.find.mockResolvedValue(mockUsers);
      mockMatchingService.generateDailySelection.mockResolvedValue({
        id: 'selection1',
      });
      mockNotificationsService.sendDailySelectionNotification.mockRejectedValue(
        new Error('Notification service unavailable'),
      );

      await scheduler.generateDailySelectionsForAllUsers();

      expect(mockMatchingService.generateDailySelection).toHaveBeenCalledWith(
        'user1',
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send daily selection notification'),
        'MatchingScheduler',
      );
      // Selection should still be counted as success
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('completed'),
        expect.objectContaining({
          successCount: 1,
          errorCount: 0,
        }),
      );
    });

    it('should log warning when error rate is high', async () => {
      const mockUsers = [
        { id: 'user1', isProfileCompleted: true },
        { id: 'user2', isProfileCompleted: true },
        { id: 'user3', isProfileCompleted: true },
        { id: 'user4', isProfileCompleted: true },
      ];

      mockUserRepository.find.mockResolvedValue(mockUsers);
      mockMatchingService.generateDailySelection
        .mockResolvedValueOnce({ id: 'selection1' })
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockRejectedValueOnce(new Error('Error 3'));

      mockNotificationsService.sendDailySelectionNotification.mockResolvedValue(
        true,
      );

      await scheduler.generateDailySelectionsForAllUsers();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Daily selection generation had'),
        'MatchingScheduler',
      );
    });

    it('should handle catastrophic failure', async () => {
      mockUserRepository.find.mockRejectedValue(
        new Error('Database connection lost'),
      );

      await expect(
        scheduler.generateDailySelectionsForAllUsers(),
      ).rejects.toThrow('Database connection lost');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('catastrophically'),
        expect.any(String),
        'MatchingScheduler',
      );
    });

    it('should skip users with existing selections', async () => {
      const mockUsers = [{ id: 'user1', isProfileCompleted: true }];

      mockUserRepository.find.mockResolvedValue(mockUsers);
      mockMatchingService.generateDailySelection.mockRejectedValue(
        new Error('User already has a selection for today'),
      );

      await scheduler.generateDailySelectionsForAllUsers();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('completed'),
        expect.objectContaining({
          skippedCount: 1,
        }),
      );
    });
  });

  describe('cleanupOldDailySelections', () => {
    it('should delete daily selections older than 30 days', async () => {
      await scheduler.cleanupOldDailySelections();

      expect(
        mockDailySelectionRepository.createQueryBuilder,
      ).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting daily selections cleanup'),
        expect.any(Object),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('cleanup completed'),
        expect.objectContaining({
          deletedCount: 10,
        }),
      );
    });

    it('should handle cleanup errors', async () => {
      mockDailySelectionRepository.createQueryBuilder.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(scheduler.cleanupOldDailySelections()).rejects.toThrow(
        'Database error',
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('cleanup job failed'),
        expect.any(String),
        'MatchingScheduler',
      );
    });
  });

  describe('Manual triggers', () => {
    it('should allow manual trigger in development environment', async () => {
      mockUserRepository.find.mockResolvedValue([]);

      await scheduler.triggerDailySelectionGeneration();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Manual trigger'),
        expect.any(Object),
      );
    });

    it('should prevent manual trigger in production', async () => {
      mockConfigService.get.mockReturnValue('production');

      await expect(scheduler.triggerDailySelectionGeneration()).rejects.toThrow(
        'Manual trigger not allowed in production',
      );
    });

    it('should allow manual cleanup trigger in development', async () => {
      mockConfigService.get.mockReturnValue('development');
      // Reset the mock to return success for this test
      mockDailySelectionRepository.createQueryBuilder.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      });

      await scheduler.triggerCleanup();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Manual trigger'),
        expect.any(Object),
      );
    });
  });
});
