import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import {
  createSentryTelemetry,
  InMemoryTelemetry,
  NoopTelemetry
} from '../src/infrastructure/telemetry';

describe('APM Telemetry (Sentry Adapter, Trazas, Errores y Mensajes)', () => {
  it('NoopTelemetry opera de forma segura sin enviar telemetría', async () => {
    const noop = new NoopTelemetry();
    expect(noop.enabled).toBe(false);
    expect(noop.getTracePropagationHeaders()).toEqual({});
    expect(noop.captureException(new Error('ignored'))).toBeUndefined();
    expect(noop.captureMessage('ignored')).toBeUndefined();

    const value = await noop.withIncomingTrace({ sentryTrace: 'trace-1' }, () =>
      noop.startSpan({ name: 'noop.span', op: 'test' }, (controls) => {
        controls.setHttpStatus(200);
        controls.setAttribute('k', 'v');
        return 'ok';
      })
    );
    expect(value).toBe('ok');
  });

  it('registra Trazas distribuidas, Mensajes APM y Errores 500 en app.ts sin filtrar 4xx como crashes', async () => {
    const telemetry = new InMemoryTelemetry();
    const app = createApp({ telemetry, environment: 'staging-dev' });

    // 1. Verificar health reporta APM Sentry activo y ambiente
    const healthRes = await app.request('/api/v1/health');
    expect(healthRes.status).toBe(200);
    const healthJson = await healthRes.json();
    expect(healthJson.environment).toBe('staging-dev');
    expect(healthJson.apm).toEqual({ provider: 'sentry', enabled: true });

    // 2. Traza distribuida + Mensaje APM con headers Sentry propagados
    const msgRes = await app.request(
      '/api/v1/apm/test?mode=message&message=VerificacionDevPipeline',
      {
        headers: {
          'sentry-trace': '1234567890abcdef1234567890abcdef-1234567890abcdef-1',
          baggage: 'sentry-environment=dev'
        }
      }
    );
    expect(msgRes.status).toBe(200);
    const msgJson = await msgRes.json();
    expect(msgJson.apm).toBe('recorded');
    expect(msgJson.sentryEnabled).toBe(true);
    expect(msgJson.sentryEventId).toMatch(/^sentry-msg-/);
    expect(msgJson.message).toBe('VerificacionDevPipeline');

    expect(
      telemetry.spans.some(
        (s) =>
          s.name === 'GET /api/v1/apm/test' &&
          s.op === 'http.server' &&
          s.statusCode === 200 &&
          s.incomingSentryTrace === '1234567890abcdef1234567890abcdef-1234567890abcdef-1'
      )
    ).toBe(true);
    expect(
      telemetry.spans.some((s) => s.name === 'planora.apm.diagnostic.message' && s.op === 'apm.diagnostic')
    ).toBe(true);
    expect(telemetry.messages).toHaveLength(1);
    expect(telemetry.messages[0]?.message).toBe('VerificacionDevPipeline');

    // 3. Error controlado 500 capturado por Sentry APM
    const errRes = await app.request('/api/v1/apm/test?mode=error');
    expect(errRes.status).toBe(500);
    const errJson = await errRes.json();
    expect(errJson.error).toBe('INTERNAL_SERVER_ERROR');
    expect(errJson.sentryEventId).toMatch(/^sentry-err-/);
    expect(telemetry.errors).toHaveLength(1);
    expect(telemetry.errors[0]?.message).toContain('APM_SIMULATED_ERROR');
    expect(telemetry.errors[0]?.context?.statusCode).toBe(500);

    // 4. Error de dominio 401 NO genera ruido en errores APM 500
    const unauthRes = await app.request('/api/v1/events');
    expect(unauthRes.status).toBe(401);
    expect(telemetry.errors).toHaveLength(1);
  });

  it('createSentryTelemetry delega trazas, errores y mensajes al SDK de Sentry cuando está inicializado', () => {
    const scopeMock = {
      setTag: vi.fn(),
      setExtra: vi.fn(),
      setContext: vi.fn(),
      setUser: vi.fn(),
      setLevel: vi.fn()
    };
    const spanMock = {
      setAttribute: vi.fn()
    };
    let initialized = false;
    const continueTraceSpy = vi.fn();
    const startSpanSpy = vi.fn();
    const withScopeSpy = vi.fn();
    const sdkMock = {
      isInitialized: () => initialized,
      continueTrace<T>(opts: { sentryTrace: string | undefined; baggage: string | undefined }, cb: () => T): T {
        continueTraceSpy(opts);
        return cb();
      },
      startSpan<T>(
        opts: { name: string; op?: string; attributes?: Record<string, string | number | boolean> },
        cb: (span: typeof spanMock) => T
      ): T {
        startSpanSpy(opts);
        return cb(spanMock);
      },
      setHttpStatus: vi.fn(),
      captureException: vi.fn(() => 'evt-err-99'),
      captureMessage: vi.fn(() => 'evt-msg-42'),
      withScope<T>(cb: (scope: typeof scopeMock) => T): T {
        withScopeSpy();
        return cb(scopeMock);
      },
      getTraceData: vi.fn(() => ({ 'sentry-trace': 'abc-123-1', baggage: 'sentry-release=1.0.0' }))
    };

    const telemetry = createSentryTelemetry(sdkMock);
    expect(telemetry.enabled).toBe(false);
    expect(telemetry.captureMessage('sin dsn')).toBeUndefined();
    expect(telemetry.captureException(new Error('sin dsn'))).toBeUndefined();
    expect(telemetry.getTracePropagationHeaders()).toEqual({});

    initialized = true;
    expect(telemetry.enabled).toBe(true);

    const spanOut = telemetry.withIncomingTrace(
      { sentryTrace: 'trace-hdr', baggage: 'env=prod' },
      () =>
        telemetry.startSpan({ name: 'POST /api/v1/events', op: 'http.server' }, (ctrl) => {
          ctrl.setAttribute('custom.tag', 'yes');
          ctrl.setHttpStatus(201);
          return 'created';
        })
    );
    expect(spanOut).toBe('created');
    expect(continueTraceSpy).toHaveBeenCalledTimes(1);
    expect(startSpanSpy).toHaveBeenCalledTimes(1);
    expect(sdkMock.setHttpStatus).toHaveBeenCalledWith(spanMock, 201);

    const msgId = telemetry.captureMessage('Deploy validado', {
      level: 'info',
      traceId: 'trace-1',
      userId: 'usr-admin',
      tags: { env: 'prod' },
      extra: { commit: 'abc123' }
    });
    expect(msgId).toBe('evt-msg-42');
    expect(scopeMock.setLevel).toHaveBeenCalledWith('info');
    expect(sdkMock.captureMessage).toHaveBeenCalledWith('Deploy validado', 'info');

    const errId = telemetry.captureException(new Error('boom'), {
      traceId: 'trace-1',
      method: 'GET',
      path: '/api/v1/apm/test',
      statusCode: 500,
      userId: 'usr-admin',
      userRole: 'admin',
      extra: { attempt: 1 }
    });
    expect(errId).toBe('evt-err-99');
    expect(scopeMock.setTag).toHaveBeenCalledWith('http.status_code', '500');
    expect(sdkMock.captureException).toHaveBeenCalledTimes(1);
    expect(telemetry.getTracePropagationHeaders()).toEqual({
      'sentry-trace': 'abc-123-1',
      baggage: 'sentry-release=1.0.0'
    });
  });
});
