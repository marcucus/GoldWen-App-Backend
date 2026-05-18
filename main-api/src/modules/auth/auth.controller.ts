import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Response, Request } from 'express';

import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';

import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import {
  RegisterDto,
  SocialLoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  VerifyEmailDto,
  RefreshTokenDto,
  TwoFactorTokenDto,
  LoginWithTwoFactorDto,
} from './dto/auth.dto';
import { SuccessResponseDto } from '../../common/dto/response.dto';
import { User } from '../../database/entities/user.entity';
import { BruteForceGuard } from '../../common/guards';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private twoFactorService: TwoFactorService,
  ) {}

  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  @UseGuards(BruteForceGuard)
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);
    return {
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          isOnboardingCompleted: result.user.isOnboardingCompleted,
          isProfileCompleted: result.user.isProfileCompleted,
        },
        accessToken: result.accessToken,
      },
    };
  }

  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  @UseGuards(BruteForceGuard)
  @Post('login')
  async login(@Body() loginDto: LoginWithTwoFactorDto) {
    const result = await this.authService.login(loginDto);
    if (result.requiresTwoFactor) {
      return { success: true, requiresTwoFactor: true, message: '2FA token required' };
    }
    return {
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          isOnboardingCompleted: result.user.isOnboardingCompleted,
          isProfileCompleted: result.user.isProfileCompleted,
        },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    };
  }

  @ApiOperation({ summary: 'Social login (Google/Apple)' })
  @ApiResponse({ status: 200, description: 'Social login successful' })
  @Post('social-login')
  async socialLogin(@Body() socialLoginDto: SocialLoginDto) {
    const result = await this.authService.socialLogin(socialLoginDto);
    return {
      success: true,
      message: 'Social login successful',
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          isOnboardingCompleted: result.user.isOnboardingCompleted,
          isProfileCompleted: result.user.isProfileCompleted,
        },
        accessToken: result.accessToken,
      },
    };
  }

  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // This will redirect to Google
  }

  private client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  @ApiOperation({ summary: 'Google social authentication with ID token' })
  @ApiResponse({ status: 200, description: 'Google authentication successful' })
  @Post('google')
  async googleLogin(@Body('idToken') idToken: string) {
    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Invalid Google token');
    }

    const { sub, email, name, picture } = payload;

    return this.authService.validateGoogleUser({
      googleId: sub,
      email: email!,
      name,
      picture,
    });
  }

  @ApiOperation({ summary: 'Google OAuth callback' })
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.authService.socialLogin(req.user as any);

    // Redirect to frontend with token
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${result.accessToken}`;
    res.redirect(redirectUrl);
  }

  @ApiOperation({ summary: 'Initiate Apple OAuth login' })
  @Get('apple')
  @UseGuards(AuthGuard('apple'))
  async appleAuth() {
    // This will redirect to Apple
  }

  @ApiOperation({ summary: 'Apple social authentication with identity token' })
  @ApiResponse({ status: 200, description: 'Apple authentication successful' })
  @UseGuards(BruteForceGuard)
  @Post('apple')
  async appleLogin(
    @Body() appleTokenDto: { identityToken: string; user?: any },
  ) {
    const { identityToken, user } = appleTokenDto;

    if (!identityToken) {
      throw new Error('Identity token is required');
    }

    try {
      // Verify Apple Identity Token
      const appleIdTokenClaims = await appleSignin.verifyIdToken(identityToken, {
        // You should configure APPLE_CLIENT_ID in your environment variables (.env)
        // Set it to your App's Bundle ID (e.g. com.goldwen.app)
        audience: process.env.APPLE_CLIENT_ID, 
        ignoreExpiration: false,
      });

      const appleUserData = {
        socialId: appleIdTokenClaims.sub,
        provider: 'apple',
        email: appleIdTokenClaims.email || user?.email,
        firstName: user?.name?.firstName || 'Utilisateur',
        lastName: user?.name?.lastName || 'Apple',
      };

      return this.authService.socialLogin(appleUserData);
    } catch (e) {
      throw new Error('Invalid Apple token or verification failed');
    }
  }

  @ApiOperation({ summary: 'Apple OAuth callback' })
  @Get('apple/callback')
  @UseGuards(AuthGuard('apple'))
  async appleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.authService.socialLogin(req.user as any);

    // Redirect to frontend with token
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${result.accessToken}`;
    res.redirect(redirectUrl);
  }

  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  @UseGuards(BruteForceGuard)
  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    await this.authService.forgotPassword(forgotPasswordDto);
    return new SuccessResponseDto('Password reset email sent');
  }

  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    await this.authService.resetPassword(resetPasswordDto);
    return new SuccessResponseDto('Password reset successfully');
  }

  @ApiOperation({ summary: 'Change password (authenticated)' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('change-password')
  async changePassword(
    @Req() req: Request,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      (req.user as any).id,
      changePasswordDto,
    );
    return new SuccessResponseDto('Password changed successfully');
  }

  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid verification token' })
  @Post('verify-email')
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    await this.authService.verifyEmail(verifyEmailDto.token);
    return new SuccessResponseDto('Email verified successfully');
  }

  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getProfile(@Req() req: Request) {
    const user = req.user as User;
    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        isOnboardingCompleted: user.isOnboardingCompleted,
        isProfileCompleted: user.isProfileCompleted,
        isEmailVerified: user.isEmailVerified,
        profile: user.profile,
      },
    };
  }

  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'New access + refresh token pair issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    const result = await this.authService.refreshTokens(dto.refreshToken);
    return {
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    };
  }

  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'User logged out successfully' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(@Req() req: Request) {
    const userId = (req.user as any).id;
    const token = req.headers.authorization?.replace('Bearer ', '');

    await this.authService.logout(userId, token);

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  // ─── Two-Factor Authentication ───────────────────────────────────────────────

  @ApiOperation({ summary: 'Generate 2FA secret and QR code' })
  @ApiResponse({ status: 200, description: 'QR code and backup secret returned' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/generate')
  async generate2fa(@Req() req: Request) {
    const userId = (req.user as any).id;
    const { qrCodeUrl, secret } = await this.twoFactorService.generateSecret(userId);
    return { success: true, data: { qrCodeUrl, secret } };
  }

  @ApiOperation({ summary: 'Enable 2FA after verifying TOTP token' })
  @ApiResponse({ status: 200, description: '2FA enabled' })
  @ApiResponse({ status: 401, description: 'Invalid TOTP token' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/enable')
  async enable2fa(@Req() req: Request, @Body() dto: TwoFactorTokenDto) {
    await this.twoFactorService.enableTwoFactor((req.user as any).id, dto.token);
    return new SuccessResponseDto('2FA enabled successfully');
  }

  @ApiOperation({ summary: 'Disable 2FA by verifying current TOTP token' })
  @ApiResponse({ status: 200, description: '2FA disabled' })
  @ApiResponse({ status: 401, description: 'Invalid TOTP token' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/disable')
  async disable2fa(@Req() req: Request, @Body() dto: TwoFactorTokenDto) {
    await this.twoFactorService.disableTwoFactor((req.user as any).id, dto.token);
    return new SuccessResponseDto('2FA disabled successfully');
  }
}
