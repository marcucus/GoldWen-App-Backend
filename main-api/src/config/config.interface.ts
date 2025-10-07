export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

export interface AppConfig {
  port: number;
  environment: string;
  apiPrefix: string;
  logLevel: string;
  frontendUrl: string;
}

export interface OAuthConfig {
  google: {
    clientId: string;
    clientSecret: string;
  };
  apple: {
    clientId: string;
    teamId: string;
    keyId: string;
    privateKey: string;
  };
}

export interface FileUploadConfig {
  uploadDir: string;
  maxFileSize: number;
}

export interface NotificationConfig {
  fcmServerKey: string;
}

export interface EmailConfig {
  from: string;
  provider?: 'smtp' | 'sendgrid'; // Default to smtp for backward compatibility
  sendgridApiKey?: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
}

export interface MatchingServiceConfig {
  url: string;
}

export interface RevenueCatConfig {
  apiKey: string;
}

export interface MonitoringConfig {
  sentry: {
    dsn: string;
    environment: string;
    tracesSampleRate: number;
    profilesSampleRate: number;
  };
  datadog?: {
    apiKey: string;
    appKey: string;
  };
  alerts: {
    webhookUrl?: string;
    slackWebhookUrl?: string;
    emailRecipients: string[];
  };
}

export interface ThrottlerConfig {
  global: {
    ttl: number; // Time to live in milliseconds
    limit: number; // Max requests per TTL
  };
  sensitive: {
    ttl: number;
    limit: number;
  };
  auth: {
    ttl: number;
    limit: number;
  };
}
