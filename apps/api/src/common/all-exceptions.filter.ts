import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable
} from '@nestjs/common';

interface JsonResponse {
  status(statusCode: number): {
    json(body: unknown): unknown;
  };
}

@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<JsonResponse>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      message:
        exception instanceof HttpException ? exception.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });
  }
}
