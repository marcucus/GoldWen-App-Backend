import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

import { NotificationsService } from './notifications.service';
import { Notification } from '../../database/entities/notification.entity';
import { User } from '../../database/entities/user.entity';
import { NotificationPreferences } from '../../database/entities/notification-preferences.entity';
import { PushToken, Platform } from '../../database/entities/push-token.entity';
import { CustomLoggerService } from '../../common/logger';
import { FcmService } from './fcm.service';
import { FirebaseService } from './firebase.service';
import { ConfigService } from '@nestjs/config';

describe('NotificationsService - Push Token Management', () => {
  let service: NotificationsService;
  let pushTokenRepository: Repository<PushToken>;
  let logger: CustomLoggerService;

  const mockPushTokenRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockLogger = {
    logUserAction: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockFcmService = {
    sendToDevice: jest.fn(),
  };

  const mockFirebaseService = {
    isInitialized: jest.fn(),
    isInvalidTokenError: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(NotificationPreferences),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PushToken),
          useValue: mockPushTokenRepository,
        },
        {
          provide: CustomLoggerService,
          useValue: mockLogger,
        },
        {
          provide: FcmService,
          useValue: mockFcmService,
        },
        {
          provide: FirebaseService,
          useValue: mockFirebaseService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    pushTokenRepository = module.get<Repository<PushToken>>(
      getRepositoryToken(PushToken),
    );
    logger = module.get<CustomLoggerService>(CustomLoggerService);
  });

  describe('registerPushToken', () => {
    it('should create a new push token', async () => {
      const userId = 'user-123';
      const token = 'fcm-token-xyz';
      const platform = Platform.IOS;

      mockPushTokenRepository.findOne.mockResolvedValue(null);
      const mockPushToken = {
        id: 'token-id-123',
        userId,
        token,
        platform,
        isActive: true,
        lastUsedAt: expect.any(Date),
      };
      mockPushTokenRepository.create.mockReturnValue(mockPushToken);
      mockPushTokenRepository.save.mockResolvedValue(mockPushToken);

      const result = await service.registerPushToken(
        userId,
        token,
        platform,
        '1.0.0',
        'iPhone13,2',
      );

      expect(mockPushTokenRepository.findOne).toHaveBeenCalledWith({
        where: { token },
      });
      expect(mockPushTokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          token,
          platform,
          appVersion: '1.0.0',
          deviceId: 'iPhone13,2',
          isActive: true,
        }),
      );
      expect(mockPushTokenRepository.save).toHaveBeenCalled();
      expect(mockLogger.logUserAction).toHaveBeenCalledWith(
        'register_push_token',
        expect.objectContaining({
          userId,
          platform,
        }),
      );
      expect(result).toEqual(mockPushToken);
    });

    it('should update existing push token', async () => {
      const userId = 'user-123';
      const token = 'fcm-token-xyz';
      const platform = Platform.ANDROID;

      const existingToken = {
        id: 'token-id-123',
        userId: 'old-user-id',
        token,
        platform: Platform.IOS,
        isActive: false,
        appVersion: '0.9.0',
        deviceId: 'old-device',
      };

      mockPushTokenRepository.findOne.mockResolvedValue(existingToken);
      mockPushTokenRepository.save.mockResolvedValue({
        ...existingToken,
        userId,
        platform,
        appVersion: '1.1.0',
        deviceId: 'new-device',
        isActive: true,
      });

      const result = await service.registerPushToken(
        userId,
        token,
        platform,
        '1.1.0',
        'new-device',
      );

      expect(mockPushTokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          platform,
          appVersion: '1.1.0',
          deviceId: 'new-device',
          isActive: true,
        }),
      );
      expect(mockLogger.logUserAction).toHaveBeenCalledWith(
        'update_push_token',
        expect.any(Object),
      );
    });
  });

  describe('deletePushToken', () => {
    it('should delete a push token', async () => {
      const userId = 'user-123';
      const token = 'fcm-token-xyz';

      const mockPushToken = {
        id: 'token-id-123',
        userId,
        token,
        platform: Platform.IOS,
      };

      mockPushTokenRepository.findOne.mockResolvedValue(mockPushToken);
      mockPushTokenRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deletePushToken(userId, token);

      expect(mockPushTokenRepository.findOne).toHaveBeenCalledWith({
        where: { token, userId },
      });
      expect(mockPushTokenRepository.delete).toHaveBeenCalledWith(
        mockPushToken.id,
      );
      expect(mockLogger.logUserAction).toHaveBeenCalledWith(
        'delete_push_token',
        expect.objectContaining({
          userId,
          tokenId: mockPushToken.id,
        }),
      );
    });

    it('should throw NotFoundException if token not found', async () => {
      mockPushTokenRepository.findOne.mockResolvedValue(null);

      await expect(
        service.deletePushToken('user-123', 'non-existent-token'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserPushTokens', () => {
    it('should return active push tokens for a user', async () => {
      const userId = 'user-123';
      const mockTokens = [
        {
          id: 'token-1',
          userId,
          token: 'fcm-token-1',
          platform: Platform.IOS,
          isActive: true,
          lastUsedAt: new Date(),
        },
        {
          id: 'token-2',
          userId,
          token: 'fcm-token-2',
          platform: Platform.ANDROID,
          isActive: true,
          lastUsedAt: new Date(),
        },
      ];

      mockPushTokenRepository.find.mockResolvedValue(mockTokens);

      const result = await service.getUserPushTokens(userId);

      expect(mockPushTokenRepository.find).toHaveBeenCalledWith({
        where: { userId, isActive: true },
        order: { lastUsedAt: 'DESC' },
      });
      expect(result).toEqual(mockTokens);
    });
  });

  describe('deactivateInactivePushTokens', () => {
    it('should deactivate tokens older than 90 days', async () => {
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      };

      mockPushTokenRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.deactivateInactivePushTokens();

      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({ isActive: false });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'isActive = :isActive',
        { isActive: true },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
      expect(result).toBe(5);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Deactivated inactive push tokens',
        expect.objectContaining({
          affected: 5,
          threshold: '90 days',
        }),
      );
    });
  });

  describe('getNotificationSettings', () => {
    it('should return existing notification preferences', async () => {
      const userId = 'user-123';
      const mockUser = { id: userId, email: 'test@example.com' };
      const mockPreferences = {
        id: 'pref-123',
        userId,
        dailySelection: true,
        newMatches: true,
        newMessages: false,
        chatExpiring: true,
        subscriptionUpdates: true,
        pushNotifications: true,
        emailNotifications: false,
        marketingEmails: false,
      };

      const userRepository = service['userRepository'];
      const preferencesRepository =
        service['notificationPreferencesRepository'];

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest
        .spyOn(preferencesRepository, 'findOne')
        .mockResolvedValue(mockPreferences as any);

      const result = await service.getNotificationSettings(userId);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(preferencesRepository.findOne).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(result).toEqual({
        dailySelection: true,
        newMatches: true,
        newMessages: false,
        chatExpiring: true,
        subscriptionUpdates: true,
        pushNotifications: true,
        emailNotifications: false,
        marketingEmails: false,
      });
      expect(mockLogger.logUserAction).toHaveBeenCalledWith(
        'get_notification_settings',
        { userId },
      );
    });

    it('should create and return default preferences for new users', async () => {
      const userId = 'user-123';
      const mockUser = { id: userId, email: 'test@example.com' };
      const mockDefaultPreferences = {
        id: 'pref-456',
        userId,
        dailySelection: true,
        newMatches: true,
        newMessages: true,
        chatExpiring: true,
        subscriptionUpdates: true,
        pushNotifications: true,
        emailNotifications: true,
        marketingEmails: false,
      };

      const userRepository = service['userRepository'];
      const preferencesRepository =
        service['notificationPreferencesRepository'];

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(preferencesRepository, 'findOne').mockResolvedValue(null);
      jest
        .spyOn(preferencesRepository, 'create')
        .mockReturnValue(mockDefaultPreferences as any);
      jest
        .spyOn(preferencesRepository, 'save')
        .mockResolvedValue(mockDefaultPreferences as any);

      const result = await service.getNotificationSettings(userId);

      expect(preferencesRepository.create).toHaveBeenCalledWith({
        userId,
        dailySelection: true,
        newMatches: true,
        newMessages: true,
        chatExpiring: true,
        subscriptionUpdates: true,
        pushNotifications: true,
        emailNotifications: true,
        marketingEmails: false,
      });
      expect(preferencesRepository.save).toHaveBeenCalled();
      expect(result).toEqual({
        dailySelection: true,
        newMatches: true,
        newMessages: true,
        chatExpiring: true,
        subscriptionUpdates: true,
        pushNotifications: true,
        emailNotifications: true,
        marketingEmails: false,
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      const userId = 'nonexistent-user';
      const userRepository = service['userRepository'];

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.getNotificationSettings(userId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getNotificationSettings(userId)).rejects.toThrow(
        'User not found',
      );
    });
  });
});
