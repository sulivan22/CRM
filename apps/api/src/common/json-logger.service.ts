import { Injectable, type LoggerService } from '@nestjs/common';

@Injectable()
export class JsonLogger implements LoggerService {
  log(message: unknown, context?: string) {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string) {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string) {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      this.write('debug', message, context);
    }
  }

  verbose(message: unknown, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      this.write('verbose', message, context);
    }
  }

  private write(level: string, message: unknown, context?: string, trace?: string) {
    const payload = {
      level,
      context,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      trace,
      timestamp: new Date().toISOString()
    };

    const writer = level === 'error' ? console.error : console.log;
    writer(JSON.stringify(payload));
  }
}
