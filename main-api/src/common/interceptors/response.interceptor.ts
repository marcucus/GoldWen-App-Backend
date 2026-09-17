import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CustomLoggerService } from '../logger';
import { SuccessResponseDto, ResponseMetadata } from '../dto/response.dto';
import { User } from '../../database/entities/user.entity';

// The response body shape before this interceptor adds/normalizes metadata.
// Anything with a `success` or `message` field is treated as already
// structured (e.g. an ErrorResponseDto-like shape); everything else is
// wrapped in a SuccessResponseDto.
interface StructuredResponseBody {
  success?: unknown;
  message?: unknown;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly logger: CustomLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    return next.handle().pipe(
      map((data: unknown) => {
        const endTime = Date.now();
        const processingTime = endTime - startTime;

        // Add performance headers
        response.setHeader('X-Response-Time', `${processingTime}ms`);
        response.setHeader('X-Request-ID', this.generateRequestId());

        // Optimize response time warning
        if (processingTime > 1000) {
          this.logger.warn(
            `Slow response detected: ${processingTime}ms`,
            'ResponseInterceptor',
          );
        }

        // Log successful responses
        this.logger.info('HTTP Response', {
          method: request.method,
          url: request.url,
          statusCode: response.statusCode,
          duration: `${processingTime}ms`,
          userAgent: request.headers['user-agent'],
          ip: request.ip,
          userId: (request.user as User | undefined)?.id,
          dataSize: data ? JSON.stringify(data).length : 0,
        });

        // Enhance response with metadata if it's not already structured
        if (data && typeof data === 'object') {
          const structured = data as StructuredResponseBody;
          // If it's already a structured response, enhance metadata
          if ('success' in structured || 'message' in structured) {
            const metadata: ResponseMetadata = {
              ...structured.metadata,
              requestId: this.generateRequestId(),
              processingTime,
              loadingState: 'success',
            };

            return {
              ...structured,
              metadata,
            };
          } else {
            // Wrap raw data in success response
            return new SuccessResponseDto(
              'Operation completed successfully',
              data,
              {
                requestId: this.generateRequestId(),
                processingTime,
                loadingState: 'success',
              },
            );
          }
        }

        return data;
      }),
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
