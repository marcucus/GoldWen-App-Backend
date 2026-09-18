import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserDataService } from './user-data.service';
import { StorageService } from '../../common/services/storage.service';
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

describe('UserDataService erasure', () => {
  let service: UserDataService;
  const builder = {
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };
  const manager = {
    query: jest.fn(),
    delete: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => builder),
  };
  const repository = {
    manager: {
      transaction: jest.fn((operation: (manager: unknown) => Promise<void>) =>
        operation(manager),
      ),
    },
  };
  const storage = { deleteFile: jest.fn(), deletePrivateExport: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    manager.query.mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT ph.url'))
        return Promise.resolve([{ url: 'https://cdn.test/photo.jpg' }]);
      if (sql.startsWith('SELECT "fileUrl"'))
        return Promise.resolve([{ fileUrl: 'exports/request.json' }]);
      return Promise.resolve([]);
    });
    storage.deleteFile.mockResolvedValue(undefined);
    storage.deletePrivateExport.mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      providers: [
        UserDataService,
        ...[
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
        ].map((entity) => ({
          provide: getRepositoryToken(entity),
          useValue: repository,
        })),
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    service = module.get(UserDataService);
  });

  it('erases actual stored files before deleting the account and preserves report evidence', async () => {
    await service.deleteUserCompletely('user-id');
    expect(storage.deleteFile).toHaveBeenCalledWith(
      'https://cdn.test/photo.jpg',
      true,
    );
    expect(storage.deletePrivateExport).toHaveBeenCalledWith(
      'exports/request.json',
    );
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE reports r SET "retainedEvidence"'),
      ['user-id'],
    );
    expect(builder.from).not.toHaveBeenCalledWith('reports');
    expect(manager.delete).toHaveBeenCalledWith(User, { id: 'user-id' });
  });

  it('does not delete the database account when storage erasure fails', async () => {
    storage.deleteFile.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(service.deleteUserCompletely('user-id')).rejects.toThrow(
      'storage unavailable',
    );
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('rechecks activity under lock and preserves a user who returned after a warning', async () => {
    const now = new Date();
    manager.findOne.mockResolvedValue({
      createdAt: new Date('2020-01-01'),
      lastActiveAt: now,
      inactivityWarningSentAt: new Date('2025-01-01'),
    });
    await service.deleteUserCompletely('user-id', {
      cutoff: new Date('2025-09-17'),
      warningCutoff: new Date('2026-08-17'),
    });
    expect(manager.findOne).toHaveBeenCalledWith(User, {
      where: { id: 'user-id' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.query).not.toHaveBeenCalled();
    expect(manager.delete).not.toHaveBeenCalled();
  });
});
