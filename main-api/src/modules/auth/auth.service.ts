import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as crypto from 'crypto';

import { User } from '../../database/entities/user.entity';
import { Profile } from '../../database/entities/profile.entity';
import { PushToken } from '../../database/entities/push-token.entity';
import { UserStatus } from '../../common/enums';
import { PasswordUtil, StringUtil } from '../../common/utils';
import { EmailService } from '../email/email.service';

import {
  LoginDto,
  RegisterDto,
  SocialLoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto/auth.dto';

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(PushToken)
    private pushTokenRepository: Repository<PushToken>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    @InjectRedis() private redis: Redis,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, firstName, lastName } = registerDto;
    try {
      // Check if user already exists
      const existingUser = await this.userRepository.findOne({
        where: { email },
      });
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Hash password
      const passwordHash = await PasswordUtil.hash(password);

      // Create user
      const user = this.userRepository.create({
        email,
        passwordHash,
        status: UserStatus.PENDING,
        emailVerificationToken: StringUtil.generateRandomString(32),
      });

      const savedUser = await this.userRepository.save(user);

      // Create basic profile
      const profile = this.profileRepository.create({
        userId: savedUser.id,
        firstName,
        lastName,
      });

      await this.profileRepository.save(profile);

      // Send welcome email (async, don't wait)
      this.emailService
        .sendWelcomeEmail(savedUser.email, firstName)
        .catch(() => {
          // Email sending is not critical, so we don't throw errors
        });

      const accessToken = this.generateAccessToken(savedUser);
      const refreshToken = await this.generateRefreshToken(savedUser);

      return { user: savedUser, accessToken, refreshToken };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      this.logger.error('Error registering user', error);
      throw new InternalServerErrorException('Error registering user');
    }
  }

  async login(loginDto: LoginDto & { twoFactorToken?: string }): Promise<AuthResponse & { requiresTwoFactor?: boolean }> {
    const { email, password, twoFactorToken } = loginDto;

    // Find user with profile
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['profile'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    // Check password
    const isPasswordValid = await PasswordUtil.compare(
      password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!twoFactorToken) {
        return { user, accessToken: '', requiresTwoFactor: true };
      }
      const userWith2fa = await this.userRepository
        .createQueryBuilder('user')
        .addSelect('user.twoFactorSecret')
        .where('user.id = :id', { id: user.id })
        .getOne();

      const isValid = userWith2fa?.twoFactorSecret
        ? (await import('speakeasy')).default.totp.verify({
            secret: userWith2fa.twoFactorSecret,
            encoding: 'base32',
            token: twoFactorToken,
            window: 1,
          })
        : false;

      if (!isValid) throw new UnauthorizedException('Invalid 2FA token');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    return { user, accessToken, refreshToken };
  }

  async validateGoogleUser(profile: { email: string; googleId?: string; name?: string; picture?: string }) {
    let user = await this.userRepository.findOne({
      where: { email: profile.email },
    });

    if (!user) {
      user = this.userRepository.create({
        email: profile.email,
        // Add these properties only if they exist in your User entity
        ...(profile.googleId && { googleId: profile.googleId }),
        ...(profile.name && { name: profile.name }),
        ...(profile.picture && { picture: profile.picture }),
      } as Partial<User>);
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { token, user };
  }

  async socialLogin(socialLoginDto: SocialLoginDto): Promise<AuthResponse> {
    const { socialId, provider, email, firstName, lastName } = socialLoginDto;

    // Check if user exists with social ID
    let user = await this.userRepository.findOne({
      where: { socialId, socialProvider: provider },
      relations: ['profile'],
    });

    if (!user) {
      // Check if user exists with email
      user = await this.userRepository.findOne({
        where: { email },
        relations: ['profile'],
      });

      if (user) {
        // Link social account to existing user
        user.socialId = socialId;
        user.socialProvider = provider;
        await this.userRepository.save(user);
      } else {
        // Create new user
        user = this.userRepository.create({
          email,
          socialId,
          socialProvider: provider,
          status: UserStatus.PENDING,
          isEmailVerified: true,
        });

        const savedUser = await this.userRepository.save(user);

        // Create profile
        const profile = this.profileRepository.create({
          userId: savedUser.id,
          firstName,
          lastName,
        });

        await this.profileRepository.save(profile);
        user.profile = profile;
      }
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    return { user, accessToken, refreshToken };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<void> {
    const { email } = forgotPasswordDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      // Don't reveal if email exists
      return;
    }

    // Generate reset token
    const resetToken = StringUtil.generateRandomString(32);
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1); // 1 hour expiry

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetExpires;

    await this.userRepository.save(user);

    // Send email with reset link
    await this.emailService.sendPasswordResetEmail(user.email, resetToken);
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const { token, newPassword } = resetPasswordDto;

    const user = await this.userRepository.findOne({
      where: { resetPasswordToken: token },
    });

    if (
      !user ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await PasswordUtil.hash(newPassword);

    user.passwordHash = passwordHash;
    user.resetPasswordToken = null as any;
    user.resetPasswordExpires = null as any;

    await this.userRepository.save(user);
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await PasswordUtil.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await PasswordUtil.hash(newPassword);
    user.passwordHash = passwordHash;

    await this.userRepository.save(user);
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null as any;

    await this.userRepository.save(user);
  }

  private generateAccessToken(user: User): string {
    return this.jwtService.sign({ sub: user.id, email: user.email });
  }

  private async generateRefreshToken(user: User): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');
    await this.redis.setex(
      `refresh:${user.id}:${token}`,
      this.REFRESH_TOKEN_TTL,
      '1',
    );
    return token;
  }

  async refreshTokens(rawRefreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Find the token across all users — scan by pattern
    const keys = await this.redis.keys(`refresh:*:${rawRefreshToken}`);
    if (!keys.length) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const key = keys[0];
    const userId = key.split(':')[1];

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.redis.del(key);
      throw new UnauthorizedException('User not found or inactive');
    }

    // Rotate: delete old token, issue new pair
    await this.redis.del(key);
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    return { accessToken, refreshToken };
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['profile'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async logout(userId: string, accessToken?: string): Promise<void> {
    try {
      if (accessToken) {
        const jwtExpiresIn = this.configService.get<string>('jwt.expiresIn') ?? '24h';
        let expirationSeconds = 24 * 60 * 60;
        const match = jwtExpiresIn.match(/^(\d+)([smhd])$/);
        if (match) {
          const value = parseInt(match[1]);
          const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
          expirationSeconds = value * (multipliers[match[2]] ?? 1);
        }
        await this.redis.setex(`blacklist:token:${accessToken}`, expirationSeconds, '1');
      }

      // Revoke all refresh tokens for this user
      const refreshKeys = await this.redis.keys(`refresh:${userId}:*`);
      if (refreshKeys.length > 0) {
        await this.redis.del(...refreshKeys);
      }

      await this.pushTokenRepository.delete({ userId });

      const cacheKeys = await this.redis.keys(`user:${userId}:*`);
      if (cacheKeys.length > 0) {
        await this.redis.del(...cacheKeys);
      }

      await this.redis.del(`session:${userId}`);

      this.logger.log(`User ${userId} logged out`);
    } catch (error) {
      this.logger.error('Error during logout', error);
    }
  }
}
