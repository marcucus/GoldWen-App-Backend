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

import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterDto,
  SocialLoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  VerifyEmailDto,
  AppleAuthDto,
  GoogleAuthDto,
} from './dto/auth.dto';
import { SuccessResponseDto } from '../../common/dto/response.dto';
import { User } from '../../database/entities/user.entity';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 409, description: 'User already exists' })
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
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
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

  @ApiOperation({ summary: 'Google social authentication' })
  @ApiResponse({ status: 200, description: 'Google authentication successful' })
  @ApiResponse({ status: 401, description: 'Invalid Google token' })
  @Post('google')
  async googleAuth(@Body() googleAuthDto: GoogleAuthDto) {
    const ticket = await this.client.verifyIdToken({
      idToken: googleAuthDto.idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Invalid Google token');
    }

    const { sub, email, name, picture } = payload;

    const result = await this.authService.socialLogin({
      socialId: sub,
      provider: 'google',
      email,
      firstName: name?.split(' ')[0] || '',
      lastName: name?.split(' ').slice(1).join(' ') || '',
      profilePicture: picture,
    });

    return {
      success: true,
      message: 'Google authentication successful',
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

  @ApiOperation({ summary: 'Initiate Google OAuth login (legacy)' })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleOAuthLogin() {
    // This will redirect to Google
  }

  private client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  @Post('googleLogin')
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
      email,
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

  @ApiOperation({ summary: 'Apple social authentication' })
  @ApiResponse({ status: 200, description: 'Apple authentication successful' })
  @ApiResponse({ status: 401, description: 'Invalid Apple token' })
  @Post('apple')
  async appleAuth(@Body() appleAuthDto: AppleAuthDto) {
    // For Apple authentication, we need to verify the ID token
    // This is a simplified implementation - in production you would verify the Apple JWT
    try {
      // Parse the JWT payload without verification for now
      // In production, use Apple's public keys to verify the token
      const base64Payload = appleAuthDto.idToken.split('.')[1];
      const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());

      const { sub, email, name } = payload;

      const result = await this.authService.socialLogin({
        socialId: sub,
        provider: 'apple',
        email: email || '',
        firstName: name?.firstName || '',
        lastName: name?.lastName || '',
      });

      return {
        success: true,
        message: 'Apple authentication successful',
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
    } catch (error) {
      throw new Error('Invalid Apple token');
    }
  }

  @ApiOperation({ summary: 'Initiate Apple OAuth login (legacy)' })
  @Get('apple')
  @UseGuards(AuthGuard('apple'))
  async appleOAuthLogin() {
    // This will redirect to Apple
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
}
