import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

export const serverEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  DATABASE_URL: z.string().url(),
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_URL: z.string().url(),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  API_SWAGGER_ENABLED: z.coerce.boolean().default(true),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1)
});

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url()
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
    port: env.REDIS_PORT
  };
}
