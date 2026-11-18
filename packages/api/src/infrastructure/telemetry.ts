export type TelemetryLevel = 'info' | 'warning' | 'error';

export type TelemetryLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type TelemetryLogAttributes = Record<string, string | number | boolean | undefined>;

export interface TelemetrySpanOptions {
  name: string;
  op: string;
  attributes?: Record<string, string | number | boolean>;
}

export interface TelemetrySpanControls {
  setHttpStatus(statusCode: number): void;
  setAttribute(key: string, value: string | number | boolean): void;
}

export interface TelemetryErrorContext {
  traceId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  userId?: string;
  userRole?: string;
  extra?: Record<string, unknown>;
}

export interface TelemetryMessageContext {
  level?: TelemetryLevel;
  traceId?: string;
  userId?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export interface TelemetryPort {
  readonly enabled: boolean;
  withIncomingTrace<T>(
    headers: { sentryTrace?: string; baggage?: string },
    callback: () => T
  ): T;
  startSpan<T>(
    options: TelemetrySpanOptions,
    callback: (controls: TelemetrySpanControls) => T
  ): T;
  captureException(error: unknown, context?: TelemetryErrorContext): string | undefined;
  captureMessage(message: string, context?: TelemetryMessageContext): string | undefined;
  /** Envía un log estructurado a Sentry Logs (sección Explore → Logs). */
  log(level: TelemetryLogLevel, message: string, attributes?: TelemetryLogAttributes): void;
  getTracePropagationHeaders(): { 'sentry-trace'?: string; baggage?: string };
}

const NOOP_SPAN_CONTROLS: TelemetrySpanControls = {
  setHttpStatus: () => undefined,
  setAttribute: () => undefined
};

export class NoopTelemetry implements TelemetryPort {
  public readonly enabled = false;

  public withIncomingTrace<T>(
    _headers: { sentryTrace?: string; baggage?: string },
    callback: () => T
  ): T {
    return callback();
  }

  public startSpan<T>(
    _options: TelemetrySpanOptions,
    callback: (controls: TelemetrySpanControls) => T
  ): T {
    return callback(NOOP_SPAN_CONTROLS);
  }

  public captureException(_error?: unknown, _context?: TelemetryErrorContext): string | undefined {
    return undefined;
  }

  public captureMessage(_message?: string, _context?: TelemetryMessageContext): string | undefined {
    return undefined;
  }

  public log(
    _level?: TelemetryLogLevel,
    _message?: string,
    _attributes?: TelemetryLogAttributes
  ): void {
    return undefined;
  }

  public getTracePropagationHeaders(): { 'sentry-trace'?: string; baggage?: string } {
    return {};
  }
}

export interface RecordedSpan {
  name: string;
  op: string;
  attributes: Record<string, string | number | boolean>;
  statusCode?: number;
  incomingSentryTrace?: string;
  incomingBaggage?: string;
}

export interface RecordedError {
  eventId: string;
  message: string;
  errorName: string;
  context?: TelemetryErrorContext;
}

export interface RecordedLog {
  level: TelemetryLogLevel;
  message: string;
  attributes?: TelemetryLogAttributes;
}

export interface RecordedMessage {
  eventId: string;
  message: string;
  context?: TelemetryMessageContext;
}

/**
 * Implementación en memoria de TelemetryPort para pruebas unitarias y diagnóstico offline.
 */
export class InMemoryTelemetry implements TelemetryPort {
  public readonly enabled = true;
  public readonly spans: RecordedSpan[] = [];
  public readonly errors: RecordedError[] = [];
  public readonly messages: RecordedMessage[] = [];
  public readonly logs: RecordedLog[] = [];
  private activeIncomingTrace?: { sentryTrace?: string; baggage?: string };
  private seq = 0;

  public withIncomingTrace<T>(
    headers: { sentryTrace?: string; baggage?: string },
    callback: () => T
  ): T {
    const previous = this.activeIncomingTrace;
    this.activeIncomingTrace = headers;
    try {
      return callback();
    } finally {
      this.activeIncomingTrace = previous;
    }
  }

  public startSpan<T>(
    options: TelemetrySpanOptions,
    callback: (controls: TelemetrySpanControls) => T
  ): T {
    const entry: RecordedSpan = {
      name: options.name,
      op: options.op,
      attributes: { ...(options.attributes ?? {}) },
      incomingSentryTrace: this.activeIncomingTrace?.sentryTrace,
      incomingBaggage: this.activeIncomingTrace?.baggage
    };
    this.spans.push(entry);

    const controls: TelemetrySpanControls = {
      setHttpStatus: (statusCode: number) => {
        entry.statusCode = statusCode;
        entry.attributes['http.response.status_code'] = statusCode;
      },
      setAttribute: (key: string, value: string | number | boolean) => {
        entry.attributes[key] = value;
      }
    };

    return callback(controls);
  }

  public captureException(error: unknown, context?: TelemetryErrorContext): string {
    this.seq += 1;
    const eventId = `sentry-err-${this.seq}`;
    this.errors.push({
      eventId,
      message: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'UnknownError',
      context
    });
    return eventId;
  }

  public captureMessage(message: string, context?: TelemetryMessageContext): string {
    this.seq += 1;
    const eventId = `sentry-msg-${this.seq}`;
    this.messages.push({
      eventId,
      message,
      context
    });
    return eventId;
  }

  public log(level: TelemetryLogLevel, message: string, attributes?: TelemetryLogAttributes): void {
    this.logs.push({ level, message, attributes });
  }

  public getTracePropagationHeaders(): { 'sentry-trace'?: string; baggage?: string } {
    return this.activeIncomingTrace?.sentryTrace
      ? {
          'sentry-trace': this.activeIncomingTrace.sentryTrace,
          baggage: this.activeIncomingTrace.baggage
        }
      : {};
  }
}

export interface SentrySpanLike {
  setAttribute?(key: string, value: string | number | boolean | undefined): unknown;
}

export interface SentryScopeLike {
  setTag(key: string, value: string): unknown;
  setExtra(key: string, extra: unknown): unknown;
  setContext(name: string, context: Record<string, unknown> | null): unknown;
  setUser(user: { id?: string; role?: string } | null): unknown;
  setLevel(level: TelemetryLevel): unknown;
}

export interface SentrySdkLike<TSpan extends SentrySpanLike, TScope extends SentryScopeLike> {
  isInitialized(): boolean;
  continueTrace<T>(
    options: { sentryTrace: string | undefined; baggage: string | undefined },
    callback: () => T
  ): T;
  startSpan<T>(
    options: {
      name: string;
      op?: string;
      attributes?: Record<string, string | number | boolean>;
    },
    callback: (span: TSpan) => T
  ): T;
  setHttpStatus(span: TSpan, httpStatus: number): void;
  captureException(exception: unknown): string;
  captureMessage(message: string, captureContext?: TelemetryLevel): string;
  withScope<T>(callback: (scope: TScope) => T): T;
  getTraceData?(): { 'sentry-trace'?: string; baggage?: string };
  logger?: SentryLoggerLike;
}

export type SentryLoggerLike = Record<
  TelemetryLogLevel,
  (message: string, attributes?: Record<string, string | number | boolean>) => void
>;

/**
 * Adapta @sentry/node o @sentry/cloudflare al puerto runtime-agnostic TelemetryPort.
 */
export function createSentryTelemetry<
  TSpan extends SentrySpanLike,
  TScope extends SentryScopeLike
>(sdk: SentrySdkLike<TSpan, TScope>): TelemetryPort {
  return {
    get enabled(): boolean {
      return sdk.isInitialized();
    },

    withIncomingTrace<T>(
      headers: { sentryTrace?: string; baggage?: string },
      callback: () => T
    ): T {
      if (!sdk.isInitialized() || (!headers.sentryTrace && !headers.baggage)) {
        return callback();
      }
      return sdk.continueTrace(
        {
          sentryTrace: headers.sentryTrace,
          baggage: headers.baggage
        },
        callback
      );
    },

    startSpan<T>(
      options: TelemetrySpanOptions,
      callback: (controls: TelemetrySpanControls) => T
    ): T {
      if (!sdk.isInitialized()) {
        return callback(NOOP_SPAN_CONTROLS);
      }
      return sdk.startSpan(
        {
          name: options.name,
          op: options.op,
          attributes: options.attributes
        },
        (span) => {
          const controls: TelemetrySpanControls = {
            setHttpStatus: (statusCode: number) => {
              sdk.setHttpStatus(span, statusCode);
            },
            setAttribute: (key: string, value: string | number | boolean) => {
              span.setAttribute?.(key, value);
            }
          };
          return callback(controls);
        }
      );
    },

    captureException(error: unknown, context?: TelemetryErrorContext): string | undefined {
      if (!sdk.isInitialized()) {
        return undefined;
      }
      return sdk.withScope((scope) => {
        if (context?.traceId) scope.setTag('planora.trace_id', context.traceId);
        if (context?.method) scope.setTag('http.method', context.method);
        if (context?.path) scope.setTag('http.route', context.path);
        if (context?.statusCode !== undefined) {
          scope.setTag('http.status_code', String(context.statusCode));
        }
        if (context?.userRole) scope.setTag('user.role', context.userRole);
        if (context?.userId) {
          scope.setUser({ id: context.userId, role: context.userRole });
        }
        if (context?.extra) {
          scope.setContext('planora', context.extra);
        }
        return sdk.captureException(error);
      });
    },

    captureMessage(message: string, context?: TelemetryMessageContext): string | undefined {
      if (!sdk.isInitialized()) {
        return undefined;
      }
      const level = context?.level ?? 'info';
      return sdk.withScope((scope) => {
        scope.setLevel(level);
        if (context?.traceId) scope.setTag('planora.trace_id', context.traceId);
        if (context?.userId) scope.setUser({ id: context.userId });
        if (context?.tags) {
          for (const [key, value] of Object.entries(context.tags)) {
            scope.setTag(key, value);
          }
        }
        if (context?.extra) {
          for (const [key, value] of Object.entries(context.extra)) {
            scope.setExtra(key, value);
          }
        }
        return sdk.captureMessage(message, level);
      });
    },

    log(level: TelemetryLogLevel, message: string, attributes?: TelemetryLogAttributes): void {
      if (!sdk.isInitialized() || !sdk.logger) {
        return;
      }
      const cleanAttributes: Record<string, string | number | boolean> = {};
      for (const [key, value] of Object.entries(attributes ?? {})) {
        if (value !== undefined) cleanAttributes[key] = value;
      }
      sdk.logger[level](message, cleanAttributes);
    },

    getTracePropagationHeaders(): { 'sentry-trace'?: string; baggage?: string } {
      if (!sdk.isInitialized() || !sdk.getTraceData) {
        return {};
      }
      const data = sdk.getTraceData();
      return {
        'sentry-trace': data['sentry-trace'],
        baggage: data.baggage
      };
    }
  };
}
