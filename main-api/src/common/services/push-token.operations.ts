import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PushToken, Platform } from '../../database/entities/push-token.entity';
export async function registerPushToken(
  repository: Repository<PushToken>,
  userId: string,
  token: string,
  platform: string,
  appVersion?: string,
  deviceId?: string,
): Promise<PushToken> {
  const existing = await repository.findOne({ where: { token } });
  const values = {
    userId,
    token,
    platform: platform as Platform,
    appVersion,
    deviceId,
    isActive: true,
    lastUsedAt: new Date(),
  };
  return repository.save(
    existing ? Object.assign(existing, values) : repository.create(values),
  );
}
export async function deletePushToken(
  repository: Repository<PushToken>,
  userId: string,
  token: string,
): Promise<void> {
  const existing = await repository.findOne({ where: { userId, token } });
  if (!existing) throw new NotFoundException('Push token not found');
  await repository.delete(existing.id);
}
