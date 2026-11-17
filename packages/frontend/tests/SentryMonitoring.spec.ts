// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentryMocks = vi.hoisted(() => {
  const scope = {
    setTag: vi.fn(),
    setContext: vi.fn(),
    setLevel: vi.fn(),
    setExtras: vi.fn()
  };
  let initialized = false;
  return {
    scope,
    getInitialized: () => initialized,
    setInitialized: (val: boolean) => {
      initialized = val;
    },
    init: vi.fn(() => {
      initialized = true;
    }),
    browserTracingIntegration: vi.fn(() => ({ name: 'BrowserTracing' })),
    startSpan: vi.fn((_opts, cb: () => unknown) => cb()),
    withScope: vi.fn((cb: (s: typeof scope) => unknown) => cb(scope)),
    captureException: vi.fn(() => 'fe-err-101'),
    captureMessage: vi.fn(() => 'fe-msg-202'),
    setUser: vi.fn(),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ErrorBoundary: ({ children }: { children: unknown }) => children
  };
});

vi.mock('@sentry/react', () => ({
  init: sentryMocks.init,
  isInitialized: () => sentryMocks.getInitialized(),
  browserTracingIntegration: sentryMocks.browserTracingIntegration,
  startSpan: sentryMocks.startSpan,
  withScope: sentryMocks.withScope,
  captureException: sentryMocks.captureException,
  captureMessage: sentryMocks.captureMessage,
  setUser: sentryMocks.setUser,
  logger: sentryMocks.logger,
  ErrorBoundary: sentryMocks.ErrorBoundary
}));

describe('Frontend Sentry APM Wrapper', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    sentryMocks.setInitialized(false);
    sentryMocks.init.mockClear();
    sentryMocks.startSpan.mockClear();
    sentryMocks.withScope.mockClear();
    sentryMocks.captureException.mockClear();
    sentryMocks.captureMessage.mockClear();
    sentryMocks.setUser.mockClear();
    sentryMocks.scope.setTag.mockClear();
    sentryMocks.scope.setContext.mockClear();
    sentryMocks.scope.setLevel.mockClear();
    sentryMocks.scope.setExtras.mockClear();
  });

  it('permanece deshabilitado sin enviar red cuando falta VITE_SENTRY_DSN', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '');
    vi.stubEnv('VITE_APP_ENV', 'development');

    const sentryModule = await import('../src/monitoring/sentry');
    expect(sentryModule.initFrontendSentry()).toBe(false);
    expect(sentryModule.isFrontendSentryEnabled()).toBe(false);
    expect(sentryModule.captureFrontendException(new Error('offline'))).toBeUndefined();
    expect(sentryModule.captureFrontendMessage('offline')).toBeUndefined();
    expect(sentryModule.traceFrontendAction('op', 'ui.action', () => 'done')).toBe('done');
    expect(sentryMocks.init).not.toHaveBeenCalled();
  });

  it('inicializa Trazas, Errores y Mensajes cuando VITE_SENTRY_DSN está configurado', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://public@o0.ingest.sentry.io/123');
    vi.stubEnv('VITE_APP_ENV', 'production');
    vi.stubEnv('VITE_API_URL', 'https://api.planora.app/api/v1');
    vi.stubEnv('VITE_SENTRY_RELEASE', 'planora-frontend@1.0.0');
    vi.stubEnv('VITE_SENTRY_TRACES_SAMPLE_RATE', '0.5');

    const sentryModule = await import('../src/monitoring/sentry');
    expect(sentryModule.initFrontendSentry()).toBe(true);
    expect(sentryMocks.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://public@o0.ingest.sentry.io/123',
        environment: 'production',
        release: 'planora-frontend@1.0.0',
        tracesSampleRate: 0.5,
        tracePropagationTargets: ['localhost', /^\/api\//, 'https://api.planora.app']
      })
    );

    sentryModule.setFrontendTelemetryUser({
      id: 'usr-1',
      email: 'admin@planora.mx',
      role: 'admin'
    });
    expect(sentryMocks.setUser).toHaveBeenCalledWith({
      id: 'usr-1',
      email: 'admin@planora.mx',
      username: 'admin'
    });

    const traced = sentryModule.traceFrontendAction(
      'planora.test.span',
      'ui.action',
      () => 'ok',
      { env: 'production' }
    );
    expect(traced).toBe('ok');
    expect(sentryMocks.startSpan).toHaveBeenCalledTimes(1);

    const errId = sentryModule.captureFrontendException(new Error('UI crash'), { route: '/' });
    expect(errId).toBe('fe-err-101');
    expect(sentryMocks.captureException).toHaveBeenCalledTimes(1);

    const msgId = sentryModule.captureFrontendMessage('Mensaje APM', 'warning', { step: 2 });
    expect(msgId).toBe('fe-msg-202');
    expect(sentryMocks.scope.setLevel).toHaveBeenCalledWith('warning');
    expect(sentryMocks.captureMessage).toHaveBeenCalledWith('Mensaje APM', 'warning');

    sentryModule.logFrontend('warn', 'Log de prueba', { step: 3 });
    expect(sentryMocks.logger.warn).toHaveBeenCalledWith('Log de prueba', {
      component: 'planora-frontend',
      step: 3
    });
  });
});
