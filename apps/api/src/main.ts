import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import 'reflect-metadata';
import { AppModule } from './app.module.js';
import { JsonLogger } from './common/json-logger.service.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { SERVER_ENV } from './env.js';
import type { ServerEnv } from '@crm/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: new JsonLogger()
  });
  const env = app.get<ServerEnv>(SERVER_ENV);

  app.use(helmet());
  app.enableCors({ origin: env.API_CORS_ORIGIN, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  if (env.NODE_ENV === 'development' && env.API_SWAGGER_ENABLED) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('CRM Bootstrap API')
        .setDescription('Sprint 0 operational API')
        .setVersion('0.1.0')
        .build()
    );
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(env.API_PORT, env.API_HOST);
}

void bootstrap();
