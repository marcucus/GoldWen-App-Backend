import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { httpIntegration, expressIntegration } from '@sentry/node';
import { MonitoringConfig } from '../../config/config.interface';

type SentryFilterableData = Record<string, unknown>;

@Injectable()
export class SentryService {
  private readonly logger = new Logger(SentryService.name);

  constructor(private configService: ConfigService) {
    this.init();
  }

  private init() {
    const sentryConfig =
      this.configService.get<MonitoringConfig['sentry']>('monitoring.sentry');

    if (!sentryConfig?.dsn) {
      this.logger.debug('Sentry DSN not configured, skipping initialization');
      return;
    }

    Sentry.init({
      dsn: sentryConfig.dsn,
      environment: sentryConfig.environment,
      tracesSampleRate: sentryConfig.tracesSampleRate,
      profilesSampleRate: sentryConfig.profilesSampleRate,
      integrations: [
        nodeProfilingIntegration(),
        httpIntegration(),
        expressIntegration(),
      ],
      beforeSend(event) {
        // Filter out sensitive data
        if (event.request?.data) {
          event.request.data = SentryService.filterSensitiveData(
            event.request.data,
          );
        }
        if (event.extra) {
          event.extra = SentryService.filterSensitiveData(
            event.extra,
          ) as NonNullable<typeof event.extra>;
        }
        return event;
      },
    });

    this.logger.debug(
      `Sentry initialized for environment: ${sentryConfig.environment}`,
    );
  }

  private static filterSensitiveData(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'credit_card',
      'ssn',
      'phone',
      'email',
      'address',
    ];

    const filtered: SentryFilterableData = {
      ...(data as SentryFilterableData),
    };

    for (const field of sensitiveFields) {
      if (field in filtered) {
        filtered[field] = '[FILTERED]';
      }
    }

    // Recursively filter nested objects
    for (const key in filtered) {
      if (typeof filtered[key] === 'object' && filtered[key] !== null) {
        filtered[key] = SentryService.filterSensitiveData(filtered[key]);
      }
    }

    return filtered;
  }

  captureException(error: Error, context?: Record<string, unknown>) {
    Sentry.withScope((scope) => {
      if (context) {
        Object.keys(context).forEach((key) => {
          scope.setContext(key, context[key] as SentryFilterableData | null);
        });
      }
      Sentry.captureException(error);
    });
  }

  captureMessage(
    message: string,
    level: Sentry.SeverityLevel = 'info',
    context?: Record<string, unknown>,
  ) {
    Sentry.withScope((scope) => {
      if (context) {
        Object.keys(context).forEach((key) => {
          scope.setContext(key, context[key] as SentryFilterableData | null);
        });
      }
      scope.setLevel(level);
      Sentry.captureMessage(message);
    });
  }

  setUser(user: { id: string; email?: string; username?: string }) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  }

  addBreadcrumb(
    message: string,
    category: string,
    data?: Record<string, unknown>,
  ) {
    Sentry.addBreadcrumb({
      message,
      category,
      data: data
        ? (SentryService.filterSensitiveData(data) as SentryFilterableData)
        : undefined,
      level: 'info',
      timestamp: Date.now() / 1000,
    });
  }

  startTransaction(name: string, op: string) {
    return Sentry.startSpan({ name, op }, () => {
      // Return a span-like object for compatibility
      return {
        finish: () => {},
        setTag: (key: string, value: string) => {
          Sentry.setTag(key, value);
        },
        setData: (key: string, value: unknown) => {
          Sentry.setContext(key, value as SentryFilterableData | null);
        },
      };
    });
  }

  close(timeout?: number) {
    return Sentry.close(timeout);
  }
}
