import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { CustomLoggerService } from './common/logger';
import { HttpExceptionFilter } from './common/filters';
import { ResponseInterceptor, CacheInterceptor } from './common/interceptors';
import { SentryService } from './common/monitoring';

async function bootstrap() {
  // rawBody: true (Phase 0.4) — keeps the exact bytes Express received on
  // req.rawBody, so webhook signature checks (RevenueCat) verify the actual
  // wire payload instead of a re-serialized JSON.stringify() of the parsed
  // body, which can differ byte-for-byte and silently break HMAC checks.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  const configService = app.get(ConfigService);
  const logger = app.get(CustomLoggerService);

  // SECURITY (Phase 0.9): the local uploads/ directory (used as a storage
  // fallback when S3 is not configured — see StorageService) was served as
  // a static directory with NO authentication or access control at all:
  // anyone who could guess or enumerate a filename could fetch any uploaded
  // photo directly. It is reserved for non-production environments; a real
  // deployment must configure S3 (with the CDN/signed URLs that implies)
  // instead of relying on this route.
  if (configService.get('app.environment') !== 'production') {
    app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  }
  const reflector = app.get(Reflector);
  const sentry = app.get(SentryService);

  // Use custom logger
  app.useLogger(logger);

  const port = configService.get('app.port') || 3000;
  const apiPrefix = configService.get('app.apiPrefix') || 'api/v1';

  logger.info('🚀 Starting GoldWen API...', {
    port,
    apiPrefix,
    environment: configService.get('app.environment'),
    logLevel: configService.get('app.logLevel'),
  });

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages:
        configService.get('app.environment') === 'production',
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter(logger, sentry));

  // Global interceptors - order matters for interceptor chain
  app.useGlobalInterceptors(new CacheInterceptor(reflector));
  app.useGlobalInterceptors(new ResponseInterceptor(logger));

  // Security headers
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow CDN images
    contentSecurityPolicy: configService.get('app.environment') === 'production',
  }));

  // CORS — origines explicites uniquement
  const allowedOrigins = [
    configService.get<string>('app.frontendUrl'),
    configService.get<string>('app.webUrl'),
  ].filter(Boolean);

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin non autorisée: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
  });

  // Swagger documentation
  if (configService.get('app.environment') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('GoldWen API')
      .setDescription('GoldWen Dating App Backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('Authentication', 'User authentication and authorization')
      .addTag('Users', 'User management and profile operations')
      .addTag('Profiles', 'User profile and photo management')
      .addTag('Matching', 'Daily selection and matching algorithm')
      .addTag('Chat', 'Real-time messaging and chat management')
      .addTag('Subscriptions', 'Premium subscriptions and payments')
      .addTag('Notifications', 'Push notifications and alerts')
      .addTag('Preferences', 'User preferences management')
      .addTag('Admin', 'Administrative operations')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
  }

  await app.listen(port, '0.0.0.0');
  logger.info('🚀 GoldWen API is running successfully', {
    url: `http://192.168.1.5:${port}/${apiPrefix}`,
    networkUrl: `http://192.168.1.5:${port}/${apiPrefix}`,
    docs: `http://192.168.1.5:${port}/${apiPrefix}/docs`,
    environment: configService.get('app.environment'),
  });
}

bootstrap();
