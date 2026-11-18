import * as Sentry from '@sentry/cloudflare';
import { createApp } from './app';
import { InMemoryKV, InMemoryObjectStorage, type KVStore, type RateLimiterPort } from './infrastructure/ports';
import { D1DatabaseHealth, type D1Binding } from './infrastructure/db/d1';
import { createSentryTelemetry } from './infrastructure/telemetry';
import { PlanoraDataStore } from './infrastructure/store';

export interface WorkerEnv {
  JWT_SECRET?: string;
  DB?: D1Binding;
  KV_CACHE?: KVStore;
  AUTH_RATE_LIMITER?: RateLimiterPort;
  ALLOWED_ORIGINS?: string;
  NODE_ENV?: string;
  ENVIRONMENT?: string;
  SENTRY_DSN?: string;
  SENTRY_RELEASE?: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
}

const sharedStore = new PlanoraDataStore();
const fallbackKv = new InMemoryKV();
const fallbackStorage = new InMemoryObjectStorage();

export default Sentry.withSentry<WorkerEnv>(
  (env) => {
    const dsn = env.SENTRY_DSN?.trim();
    if (!dsn) {
      return undefined;
    }
    const parsedRate = Number(env.SENTRY_TRACES_SAMPLE_RATE ?? '1.0');
    return {
      dsn,
      environment: env.ENVIRONMENT ?? env.NODE_ENV ?? 'production',
      release: env.SENTRY_RELEASE,
      tracesSampleRate: Number.isFinite(parsedRate) ? parsedRate : 1.0
    };
  },
  {
    async fetch(request: Request, env: WorkerEnv, ctx: unknown): Promise<Response> {
      const allowedOrigins = env.ALLOWED_ORIGINS
        ? env.ALLOWED_ORIGINS.split(',')
            .map((origin) => origin.trim())
            .filter(Boolean)
        : undefined;

      const environment = env.ENVIRONMENT ?? env.NODE_ENV ?? 'production';
      const telemetry = createSentryTelemetry(Sentry);

      const app = createApp({
        store: sharedStore,
        kv: env.KV_CACHE ?? fallbackKv,
        storage: fallbackStorage,
        telemetry,
        database: env.DB ? new D1DatabaseHealth(env.DB) : undefined,
        authRateLimiter: env.AUTH_RATE_LIMITER,
        environment,
        jwtSecret: env.JWT_SECRET,
        allowedOrigins,
        isProduction: environment === 'production' || env.NODE_ENV === 'production'
      });
      return app.fetch(request, env, ctx as never);
    }
  }
);
