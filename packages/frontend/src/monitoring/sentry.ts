import * as Sentry from '@sentry/react';

export type FrontendSeverity = 'info' | 'warning' | 'error';

export interface FrontendTelemetryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
  tracePropagationTargets: Array<string | RegExp>;
}

export function resolveFrontendTelemetryConfig(): FrontendTelemetryConfig {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  const dsn = env?.VITE_SENTRY_DSN?.trim() ?? '';
  const environment = env?.VITE_APP_ENV?.trim() || env?.MODE || 'development';
  const defaultRate = environment === 'production' ? 0.2 : 1.0;
  const parsedRate = Number(env?.VITE_SENTRY_TRACES_SAMPLE_RATE ?? defaultRate);
  const tracesSampleRate = Number.isFinite(parsedRate) ? parsedRate : defaultRate;

  const tracePropagationTargets: Array<string | RegExp> = ['localhost', /^\/api\//];
  const apiUrl = env?.VITE_API_URL?.trim();
  if (apiUrl && /^https?:\/\//i.test(apiUrl)) {
    try {
      tracePropagationTargets.push(new URL(apiUrl).origin);
    } catch {
      // Ignorar URL mal formada y conservar propagación relativa
    }
  }

  return {
    dsn,
    environment,
    release: env?.VITE_SENTRY_RELEASE?.trim() || undefined,
    tracesSampleRate,
    tracePropagationTargets
  };
}

let initializedInApp = false;

/**
 * Inicializa Sentry en el frontend React para Trazas, Errores y Mensajes APM.
 */
export function initFrontendSentry(): boolean {
  const config = resolveFrontendTelemetryConfig();
  if (!config.dsn || initializedInApp) {
    return Sentry.isInitialized();
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: config.tracesSampleRate,
    tracePropagationTargets: config.tracePropagationTargets
  });
  initializedInApp = true;
  return true;
}

export function isFrontendSentryEnabled(): boolean {
  return Sentry.isInitialized();
}

export function setFrontendTelemetryUser(
  user: { id: string; email: string; role: string } | null
): void {
  if (!Sentry.isInitialized()) return;
  Sentry.setUser(user ? { id: user.id, email: user.email, username: user.role } : null);
}

export function traceFrontendAction<T>(
  name: string,
  op: string,
  callback: () => T,
  attributes?: Record<string, string | number | boolean>
): T {
  if (!Sentry.isInitialized()) {
    return callback();
  }
  return Sentry.startSpan({ name, op, attributes }, callback);
}

export function captureFrontendException(
  error: unknown,
  context?: Record<string, unknown>
): string | undefined {
  if (!Sentry.isInitialized()) {
    return undefined;
  }
  return Sentry.withScope((scope) => {
    scope.setTag('component', 'planora-frontend');
    if (context) {
      scope.setContext('planora', context);
    }
    return Sentry.captureException(error);
  });
}

export function captureFrontendMessage(
  message: string,
  level: FrontendSeverity = 'info',
  context?: Record<string, unknown>
): string | undefined {
  if (!Sentry.isInitialized()) {
    return undefined;
  }
  return Sentry.withScope((scope) => {
    scope.setLevel(level);
    scope.setTag('component', 'planora-frontend');
    if (context) {
      scope.setExtras(context);
    }
    return Sentry.captureMessage(message, level);
  });
}

export type FrontendLogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Envía un log estructurado a Sentry Logs (Explore → Logs) con nivel y atributos.
 */
export function logFrontend(
  level: FrontendLogLevel,
  message: string,
  attributes?: Record<string, string | number | boolean>
): void {
  if (!Sentry.isInitialized() || !Sentry.logger) {
    return;
  }
  Sentry.logger[level](message, { component: 'planora-frontend', ...(attributes ?? {}) });
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;

