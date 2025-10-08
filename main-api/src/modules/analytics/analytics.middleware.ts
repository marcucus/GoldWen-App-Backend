import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from './analytics.service';

/**
 * Middleware to track API requests and user actions
 * This middleware automatically tracks page views and API usage
 */
@Injectable()
export class AnalyticsMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AnalyticsMiddleware.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, path, ip } = req;
    
    // Extract user ID from request if authenticated
    const userId = (req as any).user?.id || (req as any).user?.userId;

    // Track API request
    res.on('finish', async () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      // Only track successful requests to avoid noise
      if (statusCode < 400) {
        try {
          await this.analyticsService.trackEvent({
            name: 'api_request',
            userId,
            properties: {
              method,
              path,
              statusCode,
              duration,
              ip,
              userAgent: req.get('user-agent'),
            },
          });
        } catch (error) {
          this.logger.error('Failed to track API request', error.stack);
        }
      }
    });

    next();
  }
}
