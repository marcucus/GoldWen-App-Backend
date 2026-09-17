import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CustomLoggerService } from './logger.service';
import { MetricsService } from '../monitoring/metrics.service';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  constructor(
    private readonly logger: CustomLoggerService,
    private readonly metricsService: MetricsService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    // Generate trace ID for this request
    const traceId = this.logger.generateTraceId();

    // Set request context
    this.logger.setContext({
      traceId,
      method: req.method,
      url: req.originalUrl,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Log incoming request
    this.logger.info('Incoming request', {
      method: req.method,
      url: req.originalUrl,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Store logger and trace ID in res.locals for access in controllers
    res.locals.logger = this.logger;
    res.locals.traceId = traceId;

    // Listen for response finish to log the completion
    res.on('finish', () => {
      const responseTime = Date.now() - start;
      this.logger.logRequest(req, res, responseTime);

      // Real numbers for the admin "API performance" dashboard (see
      // MetricsService.getPerformanceSummary) — this used to be hardcoded.
      const route =
        (req.route as { path?: string } | undefined)?.path || req.path;
      this.metricsService.recordHttpRequest(
        req.method,
        route,
        res.statusCode,
        responseTime,
      );

      // Clear context after request
      this.logger.clearContext();
    });

    next();
  }
}
