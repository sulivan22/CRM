import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');
const booleanEnvSchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }
  return value;
}, z.boolean());

export const serverEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  DATABASE_URL: z.string().url(),
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_URL: z.string().url(),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  API_SWAGGER_ENABLED: booleanEnvSchema.default(true),
  AUTH_COOKIE_NAME: z.string().min(1).default('crm_session'),
  AUTH_SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 7),
  AUTH_COOKIE_DOMAIN: z.string().optional(),
  AUTH_COOKIE_SECURE: booleanEnvSchema.default(false),
  PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).default(12),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),
  AI_PROVIDER: z.enum(['fake']).default('fake'),
  AI_DEFAULT_MODEL: z.string().min(1).default('fake-v1'),
  OUTREACH_GENERATION_BATCH_SIZE: z.coerce.number().int().positive().default(25),
  DELIVERY_ATTEMPTS: z.coerce.number().int().positive().default(5),
  DELIVERY_BACKOFF_MS: z.coerce.number().int().positive().default(2000),
  INBOUND_PROVIDER: z.enum(['fake', 'resend']).default('fake'),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  INBOUND_MAX_BODY_BYTES: z.coerce.number().int().positive().default(262_144),
  INBOUND_ATTEMPTS: z.coerce.number().int().positive().default(5),
  INBOUND_BACKOFF_MS: z.coerce.number().int().positive().default(2000),
});

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

export function parseServerEnv(env: NodeJS.ProcessEnv): ServerEnv {
  return serverEnvSchema.parse(env);
}

export function parseClientEnv(env: NodeJS.ProcessEnv): ClientEnv {
  return clientEnvSchema.parse(env);
}

export function getRedisConnection(env: Pick<ServerEnv, 'REDIS_HOST' | 'REDIS_PORT'>) {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  };
}
