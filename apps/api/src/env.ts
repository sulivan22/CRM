import { parseServerEnv, type ServerEnv } from '@crm/config';

export const SERVER_ENV = Symbol('SERVER_ENV');

export const serverEnvProvider = {
  provide: SERVER_ENV,
  useFactory: (): ServerEnv => parseServerEnv(process.env),
};
