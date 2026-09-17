/** Validate configuration before providers are constructed. Never include secret values in errors. */
export function validateEnvironment(env: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];
  const value = (name: string) => typeof env[name] === 'string' ? String(env[name]).trim() : '';
  const requireValue = (name: string) => { if (!value(name)) errors.push(`${name} is required`); };
  const oneOf = (name: string, choices: string[]) => {
    if (value(name) && !choices.includes(value(name))) errors.push(`${name} must be one of ${choices.join(', ')}`);
  };
  oneOf('NODE_ENV', ['development', 'test', 'production']);
  oneOf('STORAGE_PROVIDER', ['local', 's3']);
  oneOf('EMAIL_PROVIDER', ['smtp', 'sendgrid']);
  requireValue('JWT_SECRET');
  for (const name of ['PORT', 'DATABASE_PORT', 'REDIS_PORT', 'EMAIL_PORT']) {
    if (value(name) && (!/^\d+$/.test(value(name)) || Number(value(name)) < 1 || Number(value(name)) > 65535)) {
      errors.push(`${name} must be a valid port`);
    }
  }
  for (const name of ['APP_URL', 'FRONTEND_URL', 'WEB_URL', 'MATCHING_SERVICE_URL']) {
    if (value(name)) {
      try { const url = new URL(value(name)); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); }
      catch { errors.push(`${name} must be an HTTP URL`); }
    }
  }
  if (value('MIXPANEL_ENABLED') === 'true') requireValue('MIXPANEL_TOKEN');
  if (value('NODE_ENV') === 'production') {
    for (const name of ['DATABASE_HOST', 'DATABASE_USERNAME', 'DATABASE_PASSWORD', 'DATABASE_NAME',
      'REDIS_HOST', 'MATCHING_SERVICE_URL', 'MATCHING_SERVICE_API_KEY', 'REVENUECAT_API_KEY',
      'REVENUECAT_WEBHOOK_SECRET', 'MODERATION_WEBHOOK_SECRET', 'APP_URL', 'FRONTEND_URL', 'WEB_URL']) requireValue(name);
    if (value('JWT_SECRET').length < 32) errors.push('JWT_SECRET must contain at least 32 characters in production');
    if (value('STORAGE_PROVIDER') !== 's3') errors.push('Production requires STORAGE_PROVIDER=s3');
    requireValue('S3_BUCKET');
    for (const name of ['APP_URL', 'FRONTEND_URL', 'WEB_URL']) {
      if (value(name) && !value(name).startsWith('https://')) errors.push(`${name} requires HTTPS in production`);
    }
    if (!value('FIREBASE_SERVICE_ACCOUNT_PATH')) {
      for (const name of ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']) requireValue(name);
    }
    if (value('EMAIL_PROVIDER') === 'sendgrid') requireValue('SENDGRID_API_KEY');
    else for (const name of ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASSWORD']) requireValue(name);
  }
  if (errors.length) throw new Error(`Invalid environment: ${errors.join('; ')}`);
  return env;
}
