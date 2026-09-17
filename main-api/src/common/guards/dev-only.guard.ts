import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * DevOnlyGuard — Phase 0.6
 *
 * Some routes exist purely to make manual testing easier (e.g. forcing a
 * daily selection to regenerate without waiting for the cron job) and were
 * never meant to be reachable in production. Several were labelled
 * "dev only" in a comment that checked nothing at runtime — this guard
 * actually enforces it.
 */
@Injectable()
export class DevOnlyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    const environment = this.configService.get<string>('app.environment');
    if (environment === 'production') {
      throw new ForbiddenException(
        'This endpoint is only available outside production',
      );
    }
    return true;
  }
}
