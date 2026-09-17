import type { SocialLoginDto } from '../dto/auth.dto';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

// Placeholder Apple strategy - implement when passport-apple is properly configured
@Injectable()
export class AppleStrategy extends PassportStrategy(
  class Strategy {},
  'apple',
) {
  constructor(private configService: ConfigService) {
    super();
    // Apple OAuth implementation placeholder
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: {
      id: string;
      email: string;
      name?: { firstName?: string; lastName?: string };
    },
  ): Promise<SocialLoginDto> {
    const { id, email, name } = profile;

    const user = {
      socialId: id,
      provider: 'apple',
      email: email,
      firstName: name?.firstName || '',
      lastName: name?.lastName || '',
    };

    return Promise.resolve(user);
  }
}
