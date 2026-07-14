import { parseServerEnv } from '@crm/config';

const env = parseServerEnv(process.env);

console.log(
  JSON.stringify({
    service: 'worker',
    status: 'ok',
    redis: `${env.REDIS_HOST}:${env.REDIS_PORT}`,
    timestamp: new Date().toISOString()
  })
);
