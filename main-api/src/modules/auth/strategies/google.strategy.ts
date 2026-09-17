import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    const clientId = configService.get<string>('oauth.google.clientId');
    const clientSecret = configService.get<string>('oauth.google.clientSecret');
    const environment = configService.get('app.environment');

    // SECURITY (Phase 0.10): fail fast in production instead of silently
    // initializing passport-google-oauth20 with hardcoded placeholder
    // strings — those obviously can't authenticate anyone against real
    // Google APIs, so this previously just turned a config mistake into a
    // confusing runtime failure on first login attempt instead of a clear
    // startup error. Outside production, unconfigured OAuth is expected
    // (Google sign-in simply won't work locally without real credentials).
    if (environment === 'production' && (!clientId || !clientSecret)) {
      throw new Error('Google OAuth credentials not configured');
    }

    super({
      clientID: clientId || 'unconfigured-google-client-id',
      clientSecret: clientSecret || 'unconfigured-google-client-secret',
      callbackURL: '/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;

    const user = {
      socialId: id,
      provider: 'google',
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      profilePicture: photos[0].value,
    };

    done(null, user);
  }
}
