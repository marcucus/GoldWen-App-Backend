import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * ModerationWebhookGuard — Phase 0.5
 *
 * POST /moderation/webhook/photo used to accept ANY photoId with no
 * authentication at all: anyone on the internet could force
 * "moderation succeeded" (or trigger re-moderation) for an arbitrary photo.
 * This guard requires a shared secret configured out-of-band with whatever
 * calls the webhook (the upload pipeline itself, or an external moderation
 * provider), sent as `X-Moderation-Webhook-Secret`.
 */
@Injectable()
export class ModerationWebhookGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const expected = this.configService.get<string>(
      'MODERATION_WEBHOOK_SECRET',
    );

    if (!expected) {
      // Fail closed: an unconfigured secret must never be treated as "no
      // secret required".
      throw new UnauthorizedException(
        'Moderation webhook is not configured',
      );
    }

    const provided = request.headers['x-moderation-webhook-secret'];
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    return true;
  }
}
