import { serve } from '@hono/node-server';
import * as Sentry from '@sentry/node';
import { createApp } from './app';
import { createSentryTelemetry } from './infrastructure/telemetry';

const port = Number(process.env.PORT ?? 8787);
const environment =
  process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';
const sentryDsn = process.env.SENTRY_DSN?.trim();
const parsedSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '1.0');
const tracesSampleRate = Number.isFinite(parsedSampleRate) ? parsedSampleRate : 1.0;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate
  });
}

const telemetry = createSentryTelemetry(Sentry);

const rawOrigins = process.env.ALLOWED_ORIGINS ?? process.env.CORS_ORIGINS;
const allowedOrigins = rawOrigins
  ? rawOrigins.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  : undefined;

const app = createApp({
  telemetry,
  environment,
  jwtSecret: process.env.JWT_SECRET,
  allowedOrigins,
  isProduction: process.env.NODE_ENV === 'production'
});

serve(
  {
    fetch: app.fetch,
    port
  },
  (info) => {
    console.log(
      `[PLANORA API] Listening on http://localhost:${info.port}/api/v1/health (env=${environment}, sentry=${sentryDsn ? 'enabled' : 'disabled'})`
    );
  }
);
