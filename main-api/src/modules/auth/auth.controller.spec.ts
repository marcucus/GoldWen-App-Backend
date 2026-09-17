import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { BruteForceGuard } from '../../common/guards';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';

jest.mock('google-auth-library', () => {
  const verifyIdToken = jest.fn();
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken })),
    __mockVerifyIdToken: verifyIdToken,
  };
});

jest.mock('apple-signin-auth', () => ({
  __esModule: true,
  default: { verifyIdToken: jest.fn() },
}));

interface GoogleAuthLibraryMock {
  __mockVerifyIdToken: jest.Mock;
}
interface AppleSigninMock {
  default: { verifyIdToken: jest.Mock };
}

const googleAuthLibraryMock = jest.requireMock<GoogleAuthLibraryMock>(
  'google-auth-library',
);
const mockGoogleVerifyIdToken = googleAuthLibraryMock.__mockVerifyIdToken;

const appleSigninMock = jest.requireMock<AppleSigninMock>('apple-signin-auth');
const mockAppleSignin = appleSigninMock.default;

/**
 * Regression tests for Phase 0.1 — POST /auth/social-login used to accept a
 * client-supplied { socialId, email } and mint a JWT for whichever account
 * matched that email, no proof of identity required. The fix removed that
 * endpoint entirely and made the Google/Apple flows only ever pass
 * AuthService.socialLogin() data that has already been cryptographically
 * verified by Google/Apple.
 */
describe('AuthController - Phase 0.1 social login', () => {
  let controller: AuthController;

  const mockAuthService = {
    socialLogin: jest.fn(),
  };

  const mockTwoFactorService = {};

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: TwoFactorService, useValue: mockTwoFactorService },
      ],
    })
      .overrideGuard(BruteForceGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should no longer expose a direct socialLogin controller method (the removed POST /auth/social-login route)', () => {
    expect((controller as any).socialLogin).toBeUndefined();
  });

  describe('googleLogin', () => {
    it('should call authService.socialLogin only with data verified by Google, never client-supplied fields', async () => {
      mockGoogleVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-123',
          email: 'verified@example.com',
          given_name: 'Ada',
          family_name: 'Lovelace',
        }),
      });
      mockAuthService.socialLogin.mockResolvedValue({
        user: {
          id: 'user-1',
          email: 'verified@example.com',
          isOnboardingCompleted: false,
          isProfileCompleted: false,
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const result = await controller.googleLogin('a-google-id-token');

      expect(mockAuthService.socialLogin).toHaveBeenCalledWith({
        socialId: 'google-sub-123',
        provider: 'google',
        email: 'verified@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
      });
      expect(result.success).toBe(true);
    });

    it('should reject when Google fails to verify the token, without ever calling socialLogin', async () => {
      mockGoogleVerifyIdToken.mockRejectedValue(new Error('invalid token'));

      await expect(controller.googleLogin('a-bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockAuthService.socialLogin).not.toHaveBeenCalled();
    });

    it('should reject when idToken is missing from the body', async () => {
      await expect(controller.googleLogin(undefined as any)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockAuthService.socialLogin).not.toHaveBeenCalled();
    });
  });

  describe('appleLogin', () => {
    it('should call authService.socialLogin only with data verified by Apple', async () => {
      mockAppleSignin.verifyIdToken.mockResolvedValue({
        sub: 'apple-sub-123',
        email: 'verified@icloud.com',
      });
      mockAuthService.socialLogin.mockResolvedValue({
        user: {
          id: 'user-2',
          email: 'verified@icloud.com',
          isOnboardingCompleted: false,
          isProfileCompleted: false,
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      await controller.appleLogin({
        identityToken: 'an-apple-identity-token',
        user: { name: { firstName: 'Grace', lastName: 'Hopper' } },
      } as any);

      expect(mockAuthService.socialLogin).toHaveBeenCalledWith({
        socialId: 'apple-sub-123',
        provider: 'apple',
        email: 'verified@icloud.com',
        firstName: 'Grace',
        lastName: 'Hopper',
      });
    });

    it('should reject when Apple provides no email and the client cached none either', async () => {
      // Apple only sends the email on the FIRST authorization; a naive
      // implementation would otherwise create/look up a user with
      // email: undefined.
      mockAppleSignin.verifyIdToken.mockResolvedValue({
        sub: 'apple-sub-456',
        // no email field
      });

      await expect(
        controller.appleLogin({
          identityToken: 'an-apple-identity-token',
        } as any),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockAuthService.socialLogin).not.toHaveBeenCalled();
    });

    it('should reject when identityToken is missing', async () => {
      await expect(controller.appleLogin({} as any)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockAppleSignin.verifyIdToken).not.toHaveBeenCalled();
    });
  });
});
