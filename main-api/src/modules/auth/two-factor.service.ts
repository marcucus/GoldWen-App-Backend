import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { User } from '../../database/entities/user.entity';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async generateSecret(userId: string): Promise<{ qrCodeUrl: string; secret: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.twoFactorEnabled) throw new BadRequestException('2FA is already enabled');

    const secret = speakeasy.generateSecret({
      name: `GoldWen (${user.email})`,
      issuer: 'GoldWen',
      length: 32,
    });

    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({ twoFactorSecret: secret.base32 } as Partial<User>)
      .where('id = :id', { id: userId })
      .execute();

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
    return { qrCodeUrl, secret: secret.base32 };
  }

  async enableTwoFactor(userId: string, token: string): Promise<void> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.twoFactorSecret')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) throw new UnauthorizedException('User not found');
    if (user.twoFactorEnabled) throw new BadRequestException('2FA is already enabled');
    if (!user.twoFactorSecret) throw new BadRequestException('Generate a secret first');

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!isValid) throw new UnauthorizedException('Invalid TOTP token');

    user.twoFactorEnabled = true;
    await this.userRepository.save(user);
    this.logger.log(`2FA enabled for user ${userId}`);
  }

  async disableTwoFactor(userId: string, token: string): Promise<void> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.twoFactorSecret')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) throw new UnauthorizedException('User not found');
    if (!user.twoFactorEnabled) throw new BadRequestException('2FA is not enabled');

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret!,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!isValid) throw new UnauthorizedException('Invalid TOTP token');

    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({ twoFactorEnabled: false, twoFactorSecret: null } as Partial<User>)
      .where('id = :id', { id: userId })
      .execute();

    this.logger.log(`2FA disabled for user ${userId}`);
  }

  async verifyToken(userId: string, token: string): Promise<boolean> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.twoFactorSecret')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user || !user.twoFactorSecret) return false;

    return speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1,
    });
  }
}
