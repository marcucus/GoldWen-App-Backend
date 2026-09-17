import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomLoggerService } from '../logger';
import { EmailService } from '../../modules/email/email.service';
import { MonitoringConfig } from '../../config/config.interface';

export interface AlertPayload {
  level: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

// The shape actually dispatched to each channel: AlertPayload once
// sendAlert() has filled in the fields every channel needs.
interface AlertData extends AlertPayload {
  timestamp: Date;
  service: string;
  environment: string;
}

@Injectable()
export class AlertingService {
  private alertsConfig: MonitoringConfig['alerts'] | undefined;

  constructor(
    private configService: ConfigService,
    private logger: CustomLoggerService,
    private emailService: EmailService,
  ) {
    this.alertsConfig =
      this.configService.get<MonitoringConfig['alerts']>('monitoring.alerts');
  }

  async sendAlert(alert: AlertPayload) {
    const alertData = {
      ...alert,
      timestamp: alert.timestamp || new Date(),
      service: 'GoldWen-API',
      environment:
        this.configService.get<string>('app.environment') || 'development',
    };

    // Log the alert
    this.logger.error(
      `ALERT [${alert.level.toUpperCase()}]: ${alert.title}`,
      undefined,
      'AlertingService',
    );
    this.logger.info('Alert details', {
      alert: alertData,
    });

    // Send to configured channels
    const promises = [];

    if (this.alertsConfig?.webhookUrl) {
      promises.push(this.sendWebhookAlert(alertData));
    }

    if (this.alertsConfig?.slackWebhookUrl) {
      promises.push(this.sendSlackAlert(alertData));
    }

    if ((this.alertsConfig?.emailRecipients?.length ?? 0) > 0) {
      promises.push(this.sendEmailAlert(alertData));
    }

    if (promises.length === 0) {
      this.logger.warn('No alerting channels configured', 'AlertingService');
      return;
    }

    try {
      await Promise.allSettled(promises);
    } catch (error: unknown) {
      this.logger.error(
        'Failed to send some alerts',
        error instanceof Error ? error.stack : String(error),
        'AlertingService',
      );
    }
  }

  private async sendWebhookAlert(alert: AlertData) {
    try {
      const response = await fetch(this.alertsConfig!.webhookUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alert),
      });

      if (!response.ok) {
        throw new Error(`Webhook alert failed: ${response.status}`);
      }
    } catch (error: unknown) {
      this.logger.error(
        'Failed to send webhook alert',
        error instanceof Error ? error.stack : String(error),
        'AlertingService',
      );
    }
  }

  private async sendSlackAlert(alert: AlertData) {
    try {
      const color =
        alert.level === 'critical'
          ? 'danger'
          : alert.level === 'warning'
            ? 'warning'
            : 'good';

      const slackPayload = {
        attachments: [
          {
            color,
            title: `🚨 ${alert.title}`,
            text: alert.message,
            fields: [
              {
                title: 'Level',
                value: alert.level.toUpperCase(),
                short: true,
              },
              {
                title: 'Service',
                value: alert.service,
                short: true,
              },
              {
                title: 'Environment',
                value: alert.environment,
                short: true,
              },
              {
                title: 'Timestamp',
                value: alert.timestamp.toISOString(),
                short: true,
              },
            ],
            ...(alert.metadata && {
              fields: [
                ...this.getSlackFields(alert),
                {
                  title: 'Metadata',
                  value: `\`\`\`${JSON.stringify(alert.metadata, null, 2)}\`\`\``,
                  short: false,
                },
              ],
            }),
          },
        ],
      };

      const response = await fetch(this.alertsConfig!.slackWebhookUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(slackPayload),
      });

      if (!response.ok) {
        throw new Error(`Slack alert failed: ${response.status}`);
      }
    } catch (error: unknown) {
      this.logger.error(
        'Failed to send Slack alert',
        error instanceof Error ? error.stack : String(error),
        'AlertingService',
      );
    }
  }

  private getSlackFields(alert: AlertData) {
    return [
      {
        title: 'Level',
        value: alert.level.toUpperCase(),
        short: true,
      },
      {
        title: 'Service',
        value: alert.service,
        short: true,
      },
      {
        title: 'Environment',
        value: alert.environment,
        short: true,
      },
      {
        title: 'Timestamp',
        value: alert.timestamp.toISOString(),
        short: true,
      },
    ];
  }

  private async sendEmailAlert(alert: AlertData): Promise<void> {
    await Promise.all(
      this.alertsConfig!.emailRecipients.map((recipient) =>
        this.emailService.sendOperationalEmail(
          recipient,
          `[${alert.level}] ${alert.title}`,
          alert.message,
        ),
      ),
    );
  }

  // Helper methods for common alert scenarios
  async sendCriticalAlert(
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ) {
    await this.sendAlert({
      level: 'critical',
      title,
      message,
      metadata,
    });
  }

  async sendWarningAlert(
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ) {
    await this.sendAlert({
      level: 'warning',
      title,
      message,
      metadata,
    });
  }

  async sendInfoAlert(
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ) {
    await this.sendAlert({
      level: 'info',
      title,
      message,
      metadata,
    });
  }
}
