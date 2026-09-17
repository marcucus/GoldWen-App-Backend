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
import { PasswordUtil, StringUtil, TokenUtil } from '../../common/utils';
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
        // SECURITY (Phase 0.10): store only a hash, never the raw token.
        emailVerificationToken: TokenUtil.hash(
          StringUtil.generateRandomString(32),
        ),
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
    } catch (error: unknown) {
      if (error instanceof ConflictException) throw error;
      this.logger.error('Error registering user', error);
      throw new InternalServerErrorException('Error registering user');
    }
  }

  async login(
    loginDto: LoginDto & { twoFactorToken?: string },
  ): Promise<AuthResponse & { requiresTwoFactor?: boolean }> {
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

  async validateGoogleUser(profile: {
    email: string;
    googleId?: string;
    name?: string;
    picture?: string;
  }) {
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

    // Generate reset token — the raw value is emailed to the user and never
    // persisted; only its hash is stored (Phase 0.10), so a database leak
    // alone can't be used to reset anyone's password.
    const resetToken = StringUtil.generateRandomString(32);
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1); // 1 hour expiry

    user.resetPasswordToken = TokenUtil.hash(resetToken);
    user.resetPasswordExpires = resetExpires;

    await this.userRepository.save(user);

    // Send email with reset link (raw, unhashed token)
    await this.emailService.sendPasswordResetEmail(user.email, resetToken);
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const { token, newPassword } = resetPasswordDto;

    const user = await this.userRepository.findOne({
      where: { resetPasswordToken: TokenUtil.hash(token) },
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
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

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
      where: { emailVerificationToken: TokenUtil.hash(token) },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;

    await this.userRepository.save(user);
  }

  private generateAccessToken(user: User): string {
    return this.jwtService.sign({ sub: user.id, email: user.email });
  }

  // SECURITY / PERFORMANCE (Phase 0.10): `redis.keys()` walks the ENTIRE
  // Redis keyspace on every call, regardless of how specific the glob
  // pattern looks — it is not a prefix index lookup. `refreshTokens()` used
  // to run `KEYS refresh:*:<token>` on every single access-token refresh
  // (one of the highest-frequency auth operations there is), which blocks
  // Redis's single event loop for the whole instance and gets worse as the
  // user base grows. Refresh tokens are now indexed two ways instead:
  //   - `refreshtoken:<token>` → userId, for O(1) lookup by token value
  //     (replaces the KEYS scan in refreshTokens()).
  //   - `refresh:user:<userId>` → a Redis SET of that user's live tokens,
  //     for O(1)-ish bulk revocation on logout (replaces the KEYS scan in
  //     logout()).
  private async generateRefreshToken(user: User): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');
    await this.redis
      .multi()
      .setex(`refreshtoken:${token}`, this.REFRESH_TOKEN_TTL, user.id)
      .sadd(`refresh:user:${user.id}`, token)
      .expire(`refresh:user:${user.id}`, this.REFRESH_TOKEN_TTL)
      .exec();
    return token;
  }

  private async revokeRefreshToken(
    userId: string,
    token: string,
  ): Promise<void> {
    await this.redis
      .multi()
      .del(`refreshtoken:${token}`)
      .srem(`refresh:user:${userId}`, token)
      .exec();
  }

  async refreshTokens(
    rawRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const userId = await this.redis.get(`refreshtoken:${rawRefreshToken}`);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.revokeRefreshToken(userId, rawRefreshToken);
      throw new UnauthorizedException('User not found or inactive');
    }

    // Rotate: delete old token, issue new pair
    await this.revokeRefreshToken(userId, rawRefreshToken);
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
        const jwtExpiresIn =
          this.configService.get<string>('jwt.expiresIn') ?? '24h';
        let expirationSeconds = 24 * 60 * 60;
        const match = jwtExpiresIn.match(/^(\d+)([smhd])$/);
        if (match) {
          const value = parseInt(match[1]);
          const multipliers: Record<string, number> = {
            s: 1,
            m: 60,
            h: 3600,
            d: 86400,
          };
          expirationSeconds = value * (multipliers[match[2]] ?? 1);
        }
        await this.redis.setex(
          `blacklist:token:${accessToken}`,
          expirationSeconds,
          '1',
        );
      }

      // Revoke all refresh tokens for this user via the per-user SET index
      // (see generateRefreshToken) instead of a blocking KEYS scan.
      const userTokens = await this.redis.smembers(`refresh:user:${userId}`);
      if (userTokens.length > 0) {
        const pipeline = this.redis.multi();
        for (const t of userTokens) {
          pipeline.del(`refreshtoken:${t}`);
        }
        pipeline.del(`refresh:user:${userId}`);
        await pipeline.exec();
      }

      await this.pushTokenRepository.delete({ userId });

      await this.redis.del(`session:${userId}`);

      this.logger.log(`User ${userId} logged out`);
    } catch (error: unknown) {
      this.logger.error('Error during logout', error);
    }
  }
}
