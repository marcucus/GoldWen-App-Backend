import { Injectable, OnModuleInit } from '@nestjs/common';
import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });

  readonly httpRequestDurationSeconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request latency',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  });

  readonly activeUsersGauge = new Gauge({
    name: 'goldwen_active_users',
    help: 'Currently connected WebSocket users',
  });

  readonly dailyMatchesTotal = new Counter({
    name: 'goldwen_daily_matches_total',
    help: 'Total daily selections made',
  });

  readonly messagesTotal = new Counter({
    name: 'goldwen_messages_total',
    help: 'Total chat messages sent',
    labelNames: ['type'],
  });

  readonly registrationsTotal = new Counter({
    name: 'goldwen_registrations_total',
    help: 'Total user registrations',
    labelNames: ['provider'],
  });

  readonly subscriptionsTotal = new Counter({
    name: 'goldwen_subscriptions_total',
    help: 'Total subscription purchases',
    labelNames: ['plan'],
  });

  onModuleInit() {
    collectDefaultMetrics({ register });
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  getContentType(): string {
    return register.contentType;
  }
}
