import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import {
  createSentryTelemetry,
  InMemoryTelemetry,
  NoopTelemetry,
  type SentryLoggerLike
} from '../src/infrastructure/telemetry';

describe('Sentry Logs — logs estructurados con niveles', () => {
  it('registra un log por petición con nivel según el código HTTP', async () => {
    const telemetry = new InMemoryTelemetry();
    const app = createApp({ telemetry, environment: 'dev' });

    await app.request('/api/v1/health');
    await app.request('/api/v1/events');

    const ok = telemetry.logs.find((l) => l.message === 'GET /api/v1/health -> 200');
    expect(ok?.level).toBe('info');
    expect(ok?.attributes?.['http.response.status_code']).toBe(200);

    const unauthorized = telemetry.logs.find((l) => l.message === 'GET /api/v1/events -> 401');
    expect(unauthorized?.level).toBe('warn');

    const handledError = telemetry.logs.find(
      (l) => l.attributes?.['error.type'] === 'UnauthorizedError'
    );
    expect(handledError?.level).toBe('warn');
  });

  it('el endpoint /api/v1/apm/test?mode=log envía logs info y warn', async () => {
    const telemetry = new InMemoryTelemetry();
    const app = createApp({ telemetry, environment: 'dev' });

    const res = await app.request('/api/v1/apm/test?mode=log');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apm).toBe('logged');

    const levels = telemetry.logs
      .filter((l) => l.message.startsWith('Planora APM Check'))
      .map((l) => l.level);
    expect(levels).toEqual(['info', 'warn']);
  });

  it('los errores 500 se registran con nivel error', async () => {
    const telemetry = new InMemoryTelemetry();
    const app = createApp({ telemetry, environment: 'dev' });

    const res = await app.request('/api/v1/apm/test?mode=error');
    expect(res.status).toBe(500);
    expect(telemetry.logs.some((l) => l.level === 'error' && l.attributes?.['error.type'] === 'Error')).toBe(true);
  });

  it('el adaptador de Sentry delega en Sentry.logger y omite atributos vacíos', () => {
    const logger: SentryLoggerLike = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn()
    };
    const sdk = {
      isInitialized: () => true,
      continueTrace: <T>(_o: unknown, cb: () => T) => cb(),
      startSpan: <T>(_o: unknown, cb: (span: object) => T) => cb({}),
      setHttpStatus: vi.fn(),
      captureException: vi.fn(() => 'e'),
      captureMessage: vi.fn(() => 'm'),
      withScope: <T>(cb: (scope: never) => T) => cb({} as never),
      logger
    };
    const telemetry = createSentryTelemetry(sdk);
    telemetry.log('warn', 'Mensaje de prueba', { a: 1, b: undefined, c: 'x' });
    expect(logger.warn).toHaveBeenCalledWith('Mensaje de prueba', { a: 1, c: 'x' });

    const disabled = createSentryTelemetry({ ...sdk, isInitialized: () => false });
    disabled.log('error', 'no se envía');
    expect(logger.error).not.toHaveBeenCalled();

    expect(() => new NoopTelemetry().log('info', 'noop')).not.toThrow();
  });
});
