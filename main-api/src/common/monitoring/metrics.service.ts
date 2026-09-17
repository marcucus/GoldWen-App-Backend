import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  register,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

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

  // Rolling window of recent requests, used to compute the admin dashboard's
  // "API performance" numbers without parsing Prometheus's internal buckets.
  private readonly recentRequests: {
    timestamp: number;
    durationMs: number;
    isError: boolean;
  }[] = [];
  private readonly maxRecentRequests = 5000;

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ) {
    const labels = { method, route, status_code: String(statusCode) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, durationMs / 1000);

    this.recentRequests.push({
      timestamp: Date.now(),
      durationMs,
      isError: statusCode >= 500,
    });
    if (this.recentRequests.length > this.maxRecentRequests) {
      this.recentRequests.shift();
    }
  }

  /** Real numbers for the admin dashboard, replacing the previous hardcoded placeholders. */
  getPerformanceSummary(windowMs = 60_000): {
    averageResponseTime: number;
    requestsPerMinute: number;
    errorRate: number;
    sampleSize: number;
  } {
    const now = Date.now();
    const inWindow = this.recentRequests.filter(
      (r) => r.timestamp >= now - windowMs,
    );
    // Fall back to the last 100 requests if the window is quiet, so the
    // dashboard still shows something meaningful right after a deploy.
    const sample =
      inWindow.length > 0 ? inWindow : this.recentRequests.slice(-100);

    if (sample.length === 0) {
      return {
        averageResponseTime: 0,
        requestsPerMinute: 0,
        errorRate: 0,
        sampleSize: 0,
      };
    }

    const averageResponseTime =
      sample.reduce((sum, r) => sum + r.durationMs, 0) / sample.length;
    const requestsPerMinute = Math.round((inWindow.length / windowMs) * 60_000);
    const errorRate =
      (sample.filter((r) => r.isError).length / sample.length) * 100;

    return {
      averageResponseTime: Math.round(averageResponseTime),
      requestsPerMinute,
      errorRate: Math.round(errorRate * 100) / 100,
      sampleSize: sample.length,
    };
  }

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
