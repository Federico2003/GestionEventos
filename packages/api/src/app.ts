import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ZodError } from 'zod';
import { EventEntity } from './domain/entities/EventEntity';
import { EventTable } from './domain/entities/EventTable';
import { ExpenseEntity } from './domain/entities/Expense';
import { GuestEntity } from './domain/entities/GuestEntity';
import { AgendaItemEntity, TaskEntity } from './domain/entities/TaskAndAgenda';
import { ClientEntity } from './domain/entities/UserAndClient';
import { EventServiceEntity, VendorEntity } from './domain/entities/VendorAndService';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError
} from './domain/errors';
import { detectTimelineConflicts, reorderTimeline } from './domain/services/AgendaService';
import { calculateBudgetStatus } from './domain/services/BudgetCalculator';
import { getOverdueTasks } from './domain/services/TaskService';
import { generateCateringReport } from './domain/services/CateringReportService';
import {
  assignGuestToTableWithOccupancy,
  calculateRsvpMetrics,
  calculateSeatedAtTable
} from './domain/services/GuestService';
import type { UserRole } from './domain/types';
import {
  InMemoryKV,
  InMemoryObjectStorage,
  type KVStore,
  type ObjectStoragePort
} from './infrastructure/ports';
import { NotConfiguredDatabase, type DatabaseHealthPort } from './infrastructure/db/d1';
import { NoopTelemetry, type TelemetryPort } from './infrastructure/telemetry';
import { PlanoraDataStore } from './infrastructure/store';
import {
  hashPassword,
  signJwt,
  verifyJwt,
  verifyPassword,
  type JwtPayload
} from './security/jwt';
import {
  assignTableSchema,
  attachContractDocSchema,
  cancelEventSchema,
  cloneEventSchema,
  createAgendaItemSchema,
  createClientSchema,
  createContractSchema,
  createEventSchema,
  createExpenseSchema,
  createGuestSchema,
  createTableSchema,
  createTaskSchema,
  createVendorSchema,
  loginSchema,
  registerPaymentSchema,
  reorderAgendaSchema,
  updateClientSchema,
  updateEventSchema,
  updateRsvpSchema
} from './validation/schemas';

export interface AppDependencies {
  kv?: KVStore;
  storage?: ObjectStoragePort;
  store?: PlanoraDataStore;
  telemetry?: TelemetryPort;
  database?: DatabaseHealthPort;
  environment?: string;
  jwtSecret?: string;
  allowedOrigins?: string[];
  isProduction?: boolean;
}

type AppVariables = {
  user: JwtPayload;
  traceId: string;
};

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

export function createApp(deps: AppDependencies = {}): Hono<{ Variables: AppVariables }> {
  const kv = deps.kv ?? new InMemoryKV();
  const storage = deps.storage ?? new InMemoryObjectStorage();
  const store = deps.store ?? new PlanoraDataStore();
  const telemetry = deps.telemetry ?? new NoopTelemetry();
  const database = deps.database ?? new NotConfiguredDatabase();
  const isProduction =
    deps.isProduction ?? (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');
  const environment =
    deps.environment ??
    (typeof process !== 'undefined' ? process.env?.SENTRY_ENVIRONMENT ?? process.env?.NODE_ENV : undefined) ??
    (isProduction ? 'production' : 'development');
  const resolvedEnvSecret = typeof process !== 'undefined' ? process.env?.JWT_SECRET : undefined;
  const jwtSecret =
    deps.jwtSecret ?? resolvedEnvSecret ?? (isProduction ? '' : 'planora-dev-secret-key-2026');

  if (isProduction && jwtSecret.trim().length < 16) {
    throw new Error('JWT_SECRET debe configurarse con al menos 16 caracteres en producción');
  }

  async function ensureDemoPasswordsInitialized(): Promise<void> {
    if (store.hasPendingDemoPasswords()) {
      const realHash = await hashPassword('Planora2026!');
      store.updateDefaultPasswordHashes(realHash);
    }
  }

  const app = new Hono<{ Variables: AppVariables }>();
  const allowedOrigins = deps.allowedOrigins ?? DEFAULT_DEV_ORIGINS;

  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return origin;
        if (allowedOrigins.includes('*')) return '*';
        return allowedOrigins.includes(origin) ? origin : null;
      },
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type', 'x-trace-id', 'sentry-trace', 'baggage'],
      exposeHeaders: ['x-trace-id', 'sentry-trace']
    })
  );

  // Middleware de trazabilidad APM (Sentry Tracing + x-trace-id + logs estructurados)
  app.use('*', async (c, next) => {
    const traceId = c.req.header('x-trace-id') ?? crypto.randomUUID();
    c.set('traceId', traceId);
    const startMs = performance.now();

    await telemetry.withIncomingTrace(
      {
        sentryTrace: c.req.header('sentry-trace'),
        baggage: c.req.header('baggage')
      },
      () =>
        telemetry.startSpan(
          {
            name: `${c.req.method} ${c.req.path}`,
            op: 'http.server',
            attributes: {
              'http.request.method': c.req.method,
              'url.path': c.req.path,
              'planora.trace_id': traceId,
              'planora.environment': environment
            }
          },
          async (spanControls) => {
            await next();
            spanControls.setHttpStatus(c.res.status);
            c.header('x-trace-id', traceId);
            const traceHeaders = telemetry.getTracePropagationHeaders();
            if (traceHeaders['sentry-trace']) {
              c.header('sentry-trace', traceHeaders['sentry-trace']);
            }
            const durationMs = Number((performance.now() - startMs).toFixed(2));
            telemetry.log(
              c.res.status >= 500 ? 'error' : c.res.status >= 400 ? 'warn' : 'info',
              `${c.req.method} ${c.req.path} -> ${c.res.status}`,
              {
                'planora.trace_id': traceId,
                'http.request.method': c.req.method,
                'url.path': c.req.path,
                'http.response.status_code': c.res.status,
                'duration_ms': durationMs,
                environment
              }
            );
            console.info(
              JSON.stringify({
                level: 'info',
                service: 'planora-api',
                environment,
                traceId,
                method: c.req.method,
                path: c.req.path,
                status: c.res.status,
                durationMs
              })
            );
          }
        )
    );
  });

  app.onError((err, c) => {
    const traceId = c.get('traceId') ?? c.req.header('x-trace-id') ?? crypto.randomUUID();
    c.header('x-trace-id', traceId);
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'planora-api',
        environment,
        traceId,
        method: c.req.method,
        path: c.req.path,
        errorName: err.name,
        message: err.message
      })
    );
    telemetry.log(err instanceof ZodError || err instanceof DomainError ? 'warn' : 'error', err.message, {
      'planora.trace_id': traceId,
      'error.type': err.name,
      'http.request.method': c.req.method,
      'url.path': c.req.path,
      environment
    });
    if (err instanceof ZodError) {
      return c.json(
        {
          error: 'VALIDATION_ERROR',
          message: err.issues[0]?.message ?? 'Datos de entrada inválidos',
          details: err.issues
        },
        400
      );
    }

    if (err instanceof DomainError) {
      return c.json(
        {
          error: err.code,
          message: err.message
        },
        err.statusCode as 400 | 401 | 403 | 404 | 409 | 422
      );
    }

    const currentUser = c.get('user');
    const sentryEventId = telemetry.captureException(err, {
      traceId,
      method: c.req.method,
      path: c.req.path,
      statusCode: 500,
      userId: currentUser?.userId,
      userRole: currentUser?.role,
      extra: { environment }
    });

    return c.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: err instanceof Error ? err.message : 'Error interno inesperado',
        traceId,
        sentryEventId
      },
      500
    );
  });

  // Healthcheck público (Docker & Cloudflare Edge)
  app.get('/api/v1/health', async (c) => {
    return c.json({
      status: 'ok',
      service: 'planora-api',
      version: '1.0.0',
      environment,
      apm: {
        provider: 'sentry',
        enabled: telemetry.enabled
      },
      database: await database.check(),
      timestamp: new Date().toISOString()
    });
  });

  // Endpoint público de diagnóstico APM (Trazas, Mensajes y Errores en Sentry)
  app.get('/api/v1/apm/test', async (c) => {
    const mode = c.req.query('mode') ?? 'message';
    const traceId = c.get('traceId');
    const customMessage = c.req.query('message')?.trim();

    return telemetry.startSpan(
      {
        name: `planora.apm.diagnostic.${mode}`,
        op: 'apm.diagnostic',
        attributes: {
          'planora.apm.mode': mode,
          'planora.trace_id': traceId
        }
      },
      async () => {
        if (mode === 'error') {
          throw new Error(
            'APM_SIMULATED_ERROR: Excepción controlada para verificación de monitoreo APM en Sentry'
          );
        }

        if (mode === 'log') {
          telemetry.log('info', 'Planora APM Check: log informativo enviado a Sentry Logs', {
            'planora.trace_id': traceId,
            component: 'planora-api',
            environment
          });
          telemetry.log('warn', 'Planora APM Check: log de advertencia de prueba', {
            'planora.trace_id': traceId,
            component: 'planora-api',
            environment
          });
          return c.json({
            apm: 'logged',
            mode,
            traceId,
            sentryEnabled: telemetry.enabled,
            levels: ['info', 'warn'],
            timestamp: new Date().toISOString()
          });
        }

        const diagnosticMessage =
          customMessage ||
          'Planora APM Check: Mensaje y traza registrados correctamente en telemetría Sentry';
        const sentryEventId = telemetry.captureMessage(diagnosticMessage, {
          level: 'info',
          traceId,
          tags: {
            component: 'planora-api',
            environment,
            apmMode: mode
          },
          extra: {
            path: c.req.path,
            method: c.req.method
          }
        });
        const traceHeaders = telemetry.getTracePropagationHeaders();

        return c.json({
          apm: 'recorded',
          mode,
          traceId,
          sentryEnabled: telemetry.enabled,
          sentryEventId,
          sentryTraceHeader: traceHeaders['sentry-trace'],
          message: diagnosticMessage,
          timestamp: new Date().toISOString()
        });
      }
    );
  });

  // Login público
  app.post('/api/v1/auth/login', async (c) => {
    await ensureDemoPasswordsInitialized();
    const rawBody = await c.req.json().catch(() => ({}));
    const { email, password } = loginSchema.parse(rawBody);

    const normalizedEmail = email.toLowerCase();
    const matchedUser = Array.from(store.users.values()).find(
      (u) => u.email === normalizedEmail
    );

    if (!matchedUser || !matchedUser.isActive) {
      throw new UnauthorizedError('Credenciales inválidas o cuenta inactiva');
    }

    const validPassword = await telemetry.startSpan(
      {
        name: 'auth.verify_password',
        op: 'auth.crypto',
        attributes: { 'user.role': matchedUser.role }
      },
      () => verifyPassword(password, matchedUser.passwordHash)
    );
    if (!validPassword) {
      telemetry.captureMessage('Intento de inicio de sesión rechazado por contraseña inválida', {
        level: 'warning',
        traceId: c.get('traceId'),
        userId: matchedUser.id,
        tags: { component: 'auth', environment }
      });
      throw new UnauthorizedError('Credenciales inválidas o cuenta inactiva');
    }

    const token = await signJwt(
      {
        userId: matchedUser.id,
        role: matchedUser.role,
        email: matchedUser.email,
        name: matchedUser.name
      },
      jwtSecret
    );

    telemetry.log('info', 'Inicio de sesión autenticado', {
      'planora.trace_id': c.get('traceId'),
      'user.id': matchedUser.id,
      'user.role': matchedUser.role,
      environment
    });

    telemetry.captureMessage('Inicio de sesión autenticado en Planora API', {
      level: 'info',
      traceId: c.get('traceId'),
      userId: matchedUser.id,
      tags: { component: 'auth', role: matchedUser.role, environment }
    });

    return c.json({
      token,
      user: {
        id: matchedUser.id,
        name: matchedUser.name,
        email: matchedUser.email,
        role: matchedUser.role
      }
    });
  });

  // Middleware de Autenticación JWT + Revocación KV para todas las demás rutas /api/v1/*
  app.use('/api/v1/*', async (c, next) => {
    if (
      c.req.path === '/api/v1/health' ||
      c.req.path === '/api/v1/apm/test' ||
      c.req.path === '/api/v1/auth/login'
    ) {
      await next();
      return;
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token Bearer ausente en encabezado Authorization');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const payload = await verifyJwt(token, jwtSecret);

    const existingUser = store.users.get(payload.userId);
    if (existingUser && !existingUser.isActive) {
      throw new UnauthorizedError('La cuenta de usuario se encuentra inactiva');
    }

    const revoked = await kv.get(`blacklist:${payload.jti}`);
    if (revoked !== null) {
      throw new UnauthorizedError('El token de sesión fue revocado (logout)');
    }

    c.set('user', payload);
    await next();
  });

  function assertRole(user: JwtPayload, allowed: UserRole[]): void {
    if (!allowed.includes(user.role)) {
      throw new ForbiddenError(
        `El rol "${user.role}" no tiene permisos para ejecutar esta operación`
      );
    }
  }

  function resolveAuthorizedEvent(eventId: string, user: JwtPayload): EventEntity {
    const event = store.events.get(eventId);
    if (!event) {
      throw new NotFoundError(`Evento ${eventId} no encontrado`);
    }

    if (user.role === 'admin') {
      return event;
    }

    if (user.role === 'organizer') {
      if (event.organizerId !== user.userId) {
        throw new NotFoundError(`Evento ${eventId} no encontrado`);
      }
      return event;
    }

    // client: validar que el evento pertenezca al expediente vinculado a este usuario
    const clientRecord = store.clients.get(event.clientId);
    if (!clientRecord || clientRecord.userId !== user.userId) {
      throw new NotFoundError(`Evento ${eventId} no encontrado`);
    }
    return event;
  }

  function buildEventDetailPayload(event: EventEntity) {
    const eventTables = Array.from(store.tables.values())
      .filter((t) => t.eventId === event.id)
      .sort((a, b) => a.tableNumber - b.tableNumber);

    const eventGuests = Array.from(store.guests.values()).filter((g) => g.eventId === event.id);
    const eventExpenses = Array.from(store.expenses.values()).filter(
      (ex) => ex.eventId === event.id
    );
    const eventContracts = Array.from(store.contracts.values()).filter(
      (ct) => ct.eventId === event.id
    );
    const eventTasks = Array.from(store.tasks.values()).filter((tk) => tk.eventId === event.id);
    const eventAgenda = Array.from(store.agendaItems.values())
      .filter((ag) => ag.eventId === event.id)
      .sort((a, b) => a.orderIndex - b.orderIndex || a.startTime.localeCompare(b.startTime));

    const budget = calculateBudgetStatus(event.initialBudget, eventExpenses);
    const rsvpMetrics = calculateRsvpMetrics(eventGuests);
    const cateringReport = generateCateringReport(eventGuests);
    const progress = event.calculateProgress(eventTasks);
    const conflicts = detectTimelineConflicts(eventAgenda);
    const client = store.clients.get(event.clientId);

    const tablesWithOccupancy = eventTables.map((t) => {
      const seated = calculateSeatedAtTable(eventGuests, t.tableNumber);
      return {
        id: t.id,
        eventId: t.eventId,
        tableNumber: t.tableNumber,
        label: t.label,
        capacity: t.capacity,
        seated,
        availableSeats: t.availableSeats(seated)
      };
    });

    const enrichedAlerts = cateringReport.criticalAlerts.map((alert) => {
      const g = eventGuests.find((item) => item.id === alert.guestId);
      return {
        ...alert,
        guestName: g ? g.fullName : alert.guestId,
        dietaryRestrictions: g?.dietaryRestrictions ?? ''
      };
    });

    return {
      event: {
        id: event.id,
        organizerId: event.organizerId,
        clientId: event.clientId,
        clientName: client ? `${client.firstName} ${client.lastName}`.trim() : 'Sin cliente',
        clientEmail: client?.email ?? '',
        title: event.title,
        eventType: event.eventType,
        status: event.status,
        eventDate: event.eventDate.toISOString(),
        venueName: event.venueName,
        venueAddress: event.venueAddress,
        initialBudget: event.initialBudget,
        estimatedGuests: event.estimatedGuests,
        progress
      },
      budget,
      rsvpMetrics,
      cateringReport: {
        ...cateringReport,
        enrichedAlerts
      },
      tables: tablesWithOccupancy,
      guests: eventGuests.map((g) => ({
        id: g.id,
        eventId: g.eventId,
        firstName: g.firstName,
        lastName: g.lastName,
        fullName: g.fullName,
        email: g.email,
        phone: g.phone,
        tableNumber: g.tableNumber,
        rsvpStatus: g.rsvpStatus,
        plusOnes: g.plusOnes,
        totalSeats: g.totalSeats,
        mealPreference: g.mealPreference,
        allergies: g.allergies,
        hasCriticalAllergies: g.hasCriticalAllergies,
        dietaryRestrictions: g.dietaryRestrictions
      })),
      expenses: eventExpenses,
      contracts: eventContracts,
      tasks: eventTasks,
      agenda: eventAgenda,
      agendaConflicts: conflicts
    };
  }

  // Logout con revocación inmediata en KV
  app.post('/api/v1/auth/logout', async (c) => {
    const user = c.get('user');
    const nowSec = Math.floor(Date.now() / 1000);
    const ttl = Math.max(60, user.exp - nowSec);
    await kv.put(`blacklist:${user.jti}`, 'revoked', { expirationTtl: ttl });
    return c.body(null, 204);
  });

  app.get('/api/v1/auth/me', (c) => {
    const payload = c.get('user');
    const existingUser = store.users.get(payload.userId);
    return c.json({
      user: {
        id: payload.userId,
        name: existingUser?.name ?? payload.name ?? '',
        email: existingUser?.email ?? payload.email ?? '',
        role: payload.role
      }
    });
  });

  return app;
}
