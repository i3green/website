import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { Environment } from '../config';

@Catch()
export class ExceptionHandlerFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly configService: ConfigService
  ) {}

  private readonly logger = new Logger('Exception Filter');

  catch(exception: Error, host: ArgumentsHost): void {
    try {
      const { httpAdapter } = this.httpAdapterHost;
      const context = host.switchToHttp();
      const path = httpAdapter.getRequestUrl(context.getRequest());
      const env = this.configService.get('env');

      let status: number, responseBody: Record<string, any>, eventID: string;

      if (exception instanceof HttpException) {
        status = exception.getStatus();
        const res = exception.getResponse();
        responseBody = typeof res == 'string' ? { message: res } : res;
      }
      // If it's not a Nest HttpException just 500 and don't include any extra data
      else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        responseBody = {
          message:
            exception instanceof PrismaClientKnownRequestError
              ? 'Database Error'
              : 'Internal Server Error'
        };
      }

      let isActualError = !status || status >= 500;
      if (
        exception instanceof ServiceUnavailableException &&
        exception.cause === 'Killswitch'
      )
        isActualError = false;

      if (env === Environment.PRODUCTION) {
        // Don't do anything for 4xxs in prod, they're not actual errors and
        // they'll get logged by pino-http like any other response.
        if (isActualError) {
          // Dupe code, but don't want to make a pointless object for 4xxs in prod (very common)
          const msg: any = {
            path,
            name: exception.name,
            message: exception.message
          };

          // In production, send to Sentry so long as it's enabled
          if (Sentry.isInitialized()) {
            eventID = Sentry.captureException(exception);
            msg.eventID = eventID;
          }

          this.logger.error(msg);
        }
      } else {
        const msg: any = {
          path,
          name: exception.name,
          message: exception.message,
          stack: exception.stack // Stack is useful in dev, waste in prod, Sentry has all that.
        };
        if (env === Environment.DEVELOPMENT) {
          // In development, print actual errors (non-HttpException and 500s)
          // as errors and the rest as debug.
          this.logger.error(msg);
        } else {
          // In E2E tests, print everything as debug.
          this.logger.debug(msg);
        }
      }

      // Add timestamp, path to response body
      responseBody.timestamp = new Date().toISOString();
      responseBody.path = path;
      if (eventID) responseBody.errorCode = eventID;

      // Send it back
      httpAdapter.reply(context.getResponse(), responseBody, status);
    } catch (error) {
      this.logger.fatal({
        message:
          'Exception filter errored, not throwing to avoid infinite loop!\n',
        error
      });
    }
  }
}
