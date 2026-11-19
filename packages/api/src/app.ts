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
  type ObjectStoragePort,
  type RateLimiterPort
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

/**
 * Normaliza el nombre de un archivo subido para usarlo como parte de la llave en R2:
 * elimina rutas (`/`, `\\`), secuencias `..` y caracteres fuera de [A-Za-z0-9._-].
 */
export function sanitizeFileName(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop() ?? '';
  const cleaned = baseName
    .replace(/\.\.+/g, '.')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/^[.]+/, '');
  return cleaned.length > 0 ? cleaned.slice(0, 120) : 'archivo';
}

export interface AppDependencies {
  kv?: KVStore;
  storage?: ObjectStoragePort;
  store?: PlanoraDataStore;
  telemetry?: TelemetryPort;
  database?: DatabaseHealthPort;
  /** Limitador para `/api/v1/auth/*` (10 peticiones / 10 s por IP en Cloudflare). */
  authRateLimiter?: RateLimiterPort;
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

  // Rate limiting contra fuerza bruta en autenticación (binding ratelimits de Workers)
  app.use('/api/v1/auth/*', async (c, next) => {
    if (!deps.authRateLimiter) {
      await next();
      return;
    }
    const clientIp =
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      'anonymous';
    const { success } = await deps.authRateLimiter.limit({ key: `auth:${clientIp}` });
    if (!success) {
      telemetry.log('warn', `Rate limit excedido en ${c.req.method} ${c.req.path}`, {
        'http.request.method': c.req.method,
        'url.path': c.req.path
      });
      c.header('Retry-After', '10');
      return c.json(
        {
          error: 'TOO_MANY_REQUESTS',
          message: 'Demasiadas peticiones de autenticación. Intenta de nuevo en 10 segundos.'
        },
        429
      );
    }
    await next();
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

  // Dashboard consolidado
  app.get('/api/v1/dashboard', (c) => {
    const user = c.get('user');

    const visibleEvents = Array.from(store.events.values()).filter((ev) => {
      if (user.role === 'admin') return true;
      if (user.role === 'organizer') return ev.organizerId === user.userId;
      const cli = store.clients.get(ev.clientId);
      return cli?.userId === user.userId;
    });

    let totalBudgetVolume = 0;
    let totalSpentVolume = 0;
    let totalConfirmedAttendees = 0;
    let totalCriticalAllergies = 0;
    let totalTablesCount = 0;

    for (const ev of visibleEvents) {
      totalBudgetVolume += ev.initialBudget;
      const exps = Array.from(store.expenses.values()).filter((x) => x.eventId === ev.id);
      totalSpentVolume += exps.reduce((acc, item) => acc + item.amount, 0);

      const gsts = Array.from(store.guests.values()).filter((g) => g.eventId === ev.id);
      const metrics = calculateRsvpMetrics(gsts);
      totalConfirmedAttendees += metrics.totalConfirmedSeats;
      totalCriticalAllergies += gsts.filter(
        (g) => g.rsvpStatus === 'confirmed' && g.hasCriticalAllergies
      ).length;

      totalTablesCount += Array.from(store.tables.values()).filter(
        (t) => t.eventId === ev.id
      ).length;
    }

    const visibleEventIds = new Set(visibleEvents.map((ev) => ev.id));
    const visibleTasks = Array.from(store.tasks.values()).filter((tk) =>
      visibleEventIds.has(tk.eventId)
    );
    const now = new Date();
    const upcomingEvents = visibleEvents
      .filter((ev) => ev.status !== 'cancelled' && ev.status !== 'completed')
      .filter((ev) => ev.eventDate.getTime() >= now.getTime())
      .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime())
      .slice(0, 5)
      .map((ev) => ({
        id: ev.id,
        title: ev.title,
        eventDate: ev.eventDate.toISOString(),
        status: ev.status,
        venueName: ev.venueName
      }));
    const visibleContractsCount = Array.from(store.contracts.values()).filter((ct) =>
      visibleEventIds.has(ct.eventId)
    ).length;

    return c.json({
      totalEvents: visibleEvents.length,
      confirmedEvents: visibleEvents.filter((e) => e.status === 'confirmed').length,
      draftEvents: visibleEvents.filter((e) => e.status === 'draft').length,
      activeEvents: visibleEvents.filter((e) =>
        ['planning', 'confirmed', 'in_progress'].includes(e.status)
      ).length,
      totalBudgetVolume,
      totalSpentVolume,
      overallExecutionPct:
        totalBudgetVolume > 0
          ? Number(((totalSpentVolume / totalBudgetVolume) * 100).toFixed(1))
          : 0,
      totalConfirmedAttendees,
      totalTablesCount,
      totalCriticalAllergies,
      contractsInR2: visibleContractsCount,
      overdueTasks: getOverdueTasks(visibleTasks, now).length,
      upcomingEvents
    });
  });

  // Clientes (con aislamiento multitenant entre organizadores)
  app.get('/api/v1/clients', (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);

    const list = Array.from(store.clients.values()).filter((cli) =>
      user.role === 'admin' ? true : cli.organizerId === user.userId
    );
    return c.json({ clients: list });
  });

  app.post('/api/v1/clients', async (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const data = createClientSchema.parse(await c.req.json());

    let ownerOrganizerId = user.userId;
    if (user.role === 'admin') {
      if (data.organizerId) {
        const targetOrganizer = store.users.get(data.organizerId);
        if (!targetOrganizer || targetOrganizer.role === 'client') {
          throw new NotFoundError('El organizador especificado no existe');
        }
        ownerOrganizerId = targetOrganizer.id;
      } else {
        ownerOrganizerId = 'u-org';
      }
    }

    const client = new ClientEntity({
      id: `cli-${crypto.randomUUID().slice(0, 8)}`,
      organizerId: ownerOrganizerId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      notes: data.notes
    });
    store.clients.set(client.id, client);
    return c.json({ client }, 201);
  });

  app.get('/api/v1/clients/:id', (c) => {
    const user = c.get('user');
    const clientId = c.req.param('id');
    const client = store.clients.get(clientId);

    if (!client) {
      throw new NotFoundError('Cliente no encontrado');
    }

    if (user.role === 'organizer' && client.organizerId !== user.userId) {
      // Aislamiento estricto CP-SEC-05: 404 para no filtrar existencia entre organizadores
      throw new NotFoundError('Cliente no encontrado');
    }

    if (user.role === 'client' && client.userId !== user.userId) {
      throw new ForbiddenError('Solo puede consultar su propio perfil de cliente');
    }

    return c.json({ client });
  });

  app.put('/api/v1/clients/:id', async (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const clientId = c.req.param('id');
    const client = store.clients.get(clientId);

    if (!client || (user.role === 'organizer' && client.organizerId !== user.userId)) {
      throw new NotFoundError('Cliente no encontrado');
    }

    const changes = updateClientSchema.parse(await c.req.json());
    client.updateProfile(changes);
    return c.json({ client });
  });

  app.delete('/api/v1/clients/:id', (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const clientId = c.req.param('id');
    const client = store.clients.get(clientId);

    if (!client || (user.role === 'organizer' && client.organizerId !== user.userId)) {
      throw new NotFoundError('Cliente no encontrado');
    }

    const clientEvents = Array.from(store.events.values()).filter((e) => e.clientId === clientId);
    client.ensureCanBeDeleted(clientEvents);
    store.clients.delete(clientId);
    return c.body(null, 204);
  });

  // Eventos
  app.get('/api/v1/events', (c) => {
    const user = c.get('user');
    const list = Array.from(store.events.values())
      .filter((ev) => {
        if (user.role === 'admin') return true;
        if (user.role === 'organizer') return ev.organizerId === user.userId;
        const cli = store.clients.get(ev.clientId);
        return cli?.userId === user.userId;
      })
      .map((ev) => {
        const cli = store.clients.get(ev.clientId);
        const gsts = Array.from(store.guests.values()).filter((g) => g.eventId === ev.id);
        const tasks = Array.from(store.tasks.values()).filter((t) => t.eventId === ev.id);
        const exps = Array.from(store.expenses.values()).filter((x) => x.eventId === ev.id);
        const budget = calculateBudgetStatus(ev.initialBudget, exps);
        const rsvp = calculateRsvpMetrics(gsts);

        return {
          id: ev.id,
          title: ev.title,
          eventType: ev.eventType,
          status: ev.status,
          eventDate: ev.eventDate.toISOString(),
          venueName: ev.venueName,
          initialBudget: ev.initialBudget,
          estimatedGuests: ev.estimatedGuests,
          clientId: ev.clientId,
          clientName: cli ? `${cli.firstName} ${cli.lastName}`.trim() : 'Sin cliente',
          clientEmail: cli?.email ?? '',
          confirmedSeats: rsvp.totalConfirmedSeats,
          progress: ev.calculateProgress(tasks),
          budgetStatus: budget.statusAlert,
          spentPercentage: budget.spentPercentage
        };
      });

    return c.json({ events: list });
  });

  app.post('/api/v1/events', async (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const data = createEventSchema.parse(await c.req.json());

    const client = store.clients.get(data.clientId);
    if (!client || (user.role === 'organizer' && client.organizerId !== user.userId)) {
      throw new NotFoundError('El cliente especificado no existe');
    }

    const organizerId = user.role === 'organizer' ? user.userId : client.organizerId;
    const event = new EventEntity({
      id: `evt-${crypto.randomUUID().slice(0, 8)}`,
      organizerId,
      clientId: data.clientId,
      title: data.title,
      eventType: data.eventType,
      status: 'draft',
      eventDate: data.eventDate,
      venueName: data.venueName,
      venueAddress: data.venueAddress,
      initialBudget: data.initialBudget,
      estimatedGuests: data.estimatedGuests
    });

    store.events.set(event.id, event);
    return c.json({ event: buildEventDetailPayload(event).event }, 201);
  });

  app.get('/api/v1/events/:id', (c) => {
    const user = c.get('user');
    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    const detail = buildEventDetailPayload(event);

    if (user.role === 'client') {
      // El cliente visualiza el resumen macro aprobado pero no partidas ni datos internos confidenciales
      return c.json({
        ...detail,
        guests: detail.guests.map((g) => ({
          ...g,
          email: '',
          phone: ''
        })),
        contracts: detail.contracts.map((ct) => ({
          ...ct,
          agreedPrice: 0,
          notes: ''
        })),
        expenses: [],
        tasks: [],
        agendaConflicts: []
      });
    }

    return c.json(detail);
  });

  app.patch('/api/v1/events/:id', async (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    const changes = updateEventSchema.parse(await c.req.json());
    event.updateDetails(changes);
    return c.json({ event: buildEventDetailPayload(event).event });
  });

  app.delete('/api/v1/events/:id', (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    event.ensureCanBeDeleted();

    // Elimina en cascada los registros dependientes del evento
    const dependentMaps = [
      store.tables,
      store.guests,
      store.contracts,
      store.expenses,
      store.tasks,
      store.agendaItems
    ] as Array<Map<string, { eventId: string }>>;
    for (const map of dependentMaps) {
      for (const [key, record] of map) {
        if (record.eventId === event.id) {
          map.delete(key);
        }
      }
    }
    store.events.delete(event.id);
    return c.body(null, 204);
  });

  app.post('/api/v1/events/:id/confirm', (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    event.confirmEvent();
    return c.json({ status: event.status, eventId: event.id });
  });

  app.post('/api/v1/events/:id/cancel', async (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    const { reason } = cancelEventSchema.parse(await c.req.json());

    const eventTasks = Array.from(store.tasks.values()).filter((t) => t.eventId === event.id);
    const eventContracts = Array.from(store.contracts.values()).filter(
      (ct) => ct.eventId === event.id
    );
    event.cancelEvent(reason, eventTasks, eventContracts);

    return c.json({
      status: event.status,
      cancellationReason: event.cancellationReason
    });
  });

  app.post('/api/v1/events/:id/clone', async (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const sourceEvent = resolveAuthorizedEvent(c.req.param('id'), user);
    const { title, eventDate } = cloneEventSchema.parse(await c.req.json());

    const clonedId = `evt-${crypto.randomUUID().slice(0, 8)}`;
    const clonedEvent = sourceEvent.cloneStructure(clonedId, title, eventDate);
    store.events.set(clonedEvent.id, clonedEvent);

    // Clonar tareas operativas base (en estado todo) y esqueleto del cronograma
    const sourceTasks = Array.from(store.tasks.values()).filter(
      (t) => t.eventId === sourceEvent.id
    );
    for (const st of sourceTasks) {
      const nt = new TaskEntity({
        id: `tsk-${crypto.randomUUID().slice(0, 8)}`,
        eventId: clonedEvent.id,
        assignedTo: st.assignedTo,
        title: st.title,
        description: st.description,
        priority: st.priority,
        status: 'todo',
        dueDate: eventDate.slice(0, 10)
      });
      store.tasks.set(nt.id, nt);
    }

    const sourceAgenda = Array.from(store.agendaItems.values()).filter(
      (a) => a.eventId === sourceEvent.id
    );
    for (const sa of sourceAgenda) {
      const na = new AgendaItemEntity({
        id: `agd-${crypto.randomUUID().slice(0, 8)}`,
        eventId: clonedEvent.id,
        title: sa.title,
        startTime: sa.startTime,
        endTime: sa.endTime,
        responsiblePerson: sa.responsiblePerson,
        locationDetail: sa.locationDetail,
        notes: sa.notes,
        orderIndex: sa.orderIndex
      });
      store.agendaItems.set(na.id, na);
    }

    return c.json(buildEventDetailPayload(clonedEvent), 201);
  });

  // Mesas del Evento
  app.post('/api/v1/events/:id/tables', async (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    const data = createTableSchema.parse(await c.req.json());

    const duplicate = Array.from(store.tables.values()).find(
      (t) => t.eventId === event.id && t.tableNumber === data.tableNumber
    );
    if (duplicate) {
      throw new ConflictError(`La Mesa ${data.tableNumber} ya existe en este evento`);
    }

    const table = new EventTable({
      id: `tbl-${crypto.randomUUID().slice(0, 8)}`,
      eventId: event.id,
      tableNumber: data.tableNumber,
      label: data.label,
      capacity: data.capacity
    });
    store.tables.set(table.id, table);
    return c.json({ table }, 201);
  });

  // Invitados, RSVP y Aforo de Mesas (CP-MES-02)
  app.post('/api/v1/events/:id/guests', async (c) => {
    const user = c.get('user');
    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    const data = createGuestSchema.parse(await c.req.json());

    const guest = new GuestEntity({
      id: `gst-${crypto.randomUUID().slice(0, 8)}`,
      eventId: event.id,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      rsvpStatus: data.rsvpStatus,
      plusOnes: data.plusOnes,
      mealPreference: data.mealPreference,
      allergies: data.allergies,
      hasCriticalAllergies: data.hasCriticalAllergies,
      dietaryRestrictions: data.dietaryRestrictions
    });

    if (data.tableNumber !== null && data.tableNumber !== undefined) {
      assertRole(user, ['admin', 'organizer']);
      const targetTable = Array.from(store.tables.values()).find(
        (t) => t.eventId === event.id && t.tableNumber === data.tableNumber
      );
      if (!targetTable) {
        throw new NotFoundError(`La Mesa ${data.tableNumber} no está registrada en este evento`);
      }
      const eventGuests = Array.from(store.guests.values()).filter((g) => g.eventId === event.id);
      assignGuestToTableWithOccupancy(guest, targetTable, eventGuests);
    }

    store.guests.set(guest.id, guest);
    return c.json({ guestId: guest.id, guest }, 201);
  });

  app.patch('/api/v1/events/:id/guests/:guestId/rsvp', async (c) => {
    const user = c.get('user');
    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    const guestId = c.req.param('guestId');
    const guest = store.guests.get(guestId);

    if (!guest || guest.eventId !== event.id) {
      throw new NotFoundError('Invitado no encontrado en el evento');
    }

    const data = updateRsvpSchema.parse(await c.req.json());

    // Si tiene mesa asignada y no declina, validar que el nuevo número de acompañantes quepa
    if (guest.tableNumber !== null && data.rsvpStatus !== 'declined') {
      const table = Array.from(store.tables.values()).find(
        (t) => t.eventId === event.id && t.tableNumber === guest.tableNumber
      );
      if (table) {
        const eventGuests = Array.from(store.guests.values()).filter(
          (g) => g.eventId === event.id
        );
        const seatedOthers = calculateSeatedAtTable(eventGuests, table.tableNumber, guest.id);
        const tempGuest = new GuestEntity({
          id: guest.id,
          rsvpStatus: data.rsvpStatus,
          plusOnes: data.plusOnes
        });
        tempGuest.assignTable(table, seatedOthers);
      }
    }

    guest.registerRsvp(data.rsvpStatus, data.plusOnes);
    const dietaryChanged =
      data.mealPreference !== undefined ||
      data.allergies !== undefined ||
      data.hasCriticalAllergies !== undefined ||
      data.dietaryRestrictions !== undefined;
    if (dietaryChanged) {
      guest.registerDietaryProfile(
        data.mealPreference ?? guest.mealPreference,
        data.allergies ?? guest.allergies,
        data.hasCriticalAllergies ?? guest.hasCriticalAllergies,
        data.dietaryRestrictions ?? guest.dietaryRestrictions
      );
    }

    return c.json({ guest });
  });

  app.post('/api/v1/events/:id/guests/:guestId/assign-table', async (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    const guestId = c.req.param('guestId');
    const guest = store.guests.get(guestId);

    if (!guest || guest.eventId !== event.id) {
      throw new NotFoundError('Invitado no encontrado');
    }

    const { tableNumber } = assignTableSchema.parse(await c.req.json());
    const table = Array.from(store.tables.values()).find(
      (t) => t.eventId === event.id && t.tableNumber === tableNumber
    );
    if (!table) {
      throw new NotFoundError(`La Mesa ${tableNumber} no existe en este evento`);
    }

    const eventGuests = Array.from(store.guests.values()).filter((g) => g.eventId === event.id);
    assignGuestToTableWithOccupancy(guest, table, eventGuests);

    return c.json({
      guestId: guest.id,
      tableNumber: guest.tableNumber,
      seated: calculateSeatedAtTable(eventGuests, table.tableNumber)
    });
  });

  // Reporte Oficial para Catering (CP-CAT-03)
  app.get('/api/v1/events/:id/catering-report', (c) => {
    const user = c.get('user');
    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    const eventGuests = Array.from(store.guests.values()).filter((g) => g.eventId === event.id);
    const report = generateCateringReport(eventGuests);
    return c.json({ report });
  });

  // Presupuesto y Gastos (CP-FIN-01 & CP-SEC-05)
  app.get('/api/v1/events/:id/budget', (c) => {
    const user = c.get('user');
    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    const eventExpenses = Array.from(store.expenses.values()).filter(
      (ex) => ex.eventId === event.id
    );
    const budget = calculateBudgetStatus(event.initialBudget, eventExpenses);

    return c.json({
      budget,
      expenses: user.role === 'client' ? [] : eventExpenses
    });
  });

  app.post('/api/v1/events/:id/expenses', async (c) => {
    const user = c.get('user');
    // Regla estricta CP-SEC-05: rol client recibe 403 Forbidden antes de mutar cualquier gasto
    assertRole(user, ['admin', 'organizer']);

    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    const data = createExpenseSchema.parse(await c.req.json());

    const expense = new ExpenseEntity({
      id: `exp-${crypto.randomUUID().slice(0, 8)}`,
      eventId: event.id,
      eventServiceId: data.eventServiceId,
      concept: data.concept,
      category: data.category,
      amount: data.amount,
      dueDate: data.dueDate,
      paymentStatus: data.paymentStatus,
      paidAt: data.paymentStatus === 'paid' ? new Date().toISOString() : null
    });

    store.expenses.set(expense.id, expense);

    const allEventExpenses = Array.from(store.expenses.values()).filter(
      (ex) => ex.eventId === event.id
    );
    const budget = calculateBudgetStatus(event.initialBudget, allEventExpenses);

    return c.json({ expense, budget }, 201);
  });

  app.post('/api/v1/events/:id/expenses/:expenseId/pay', async (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    const expense = store.expenses.get(c.req.param('expenseId'));

    if (!expense || expense.eventId !== event.id) {
      throw new NotFoundError('Gasto no encontrado');
    }

    const { receiptFileName, contentBase64 } = registerPaymentSchema.parse(await c.req.json());
    const key = `receipts/${event.id}/${expense.id}-${sanitizeFileName(receiptFileName)}`;
    await storage.putObject(key, contentBase64, 'application/pdf');
    expense.registerPayment(key);

    return c.json({ expense });
  });

  // Proveedores y Contratos en Cloudflare R2
  app.get('/api/v1/vendors', (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const list = Array.from(store.vendors.values()).filter((v) =>
      user.role === 'admin' ? true : v.organizerId === user.userId
    );
    return c.json({ vendors: list });
  });

  app.post('/api/v1/vendors', async (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const data = createVendorSchema.parse(await c.req.json());

    const vendor = new VendorEntity({
      id: `vnd-${crypto.randomUUID().slice(0, 8)}`,
      organizerId: user.role === 'organizer' ? user.userId : 'u-org',
      ...data
    });
    store.vendors.set(vendor.id, vendor);
    return c.json({ vendor }, 201);
  });

  app.post('/api/v1/events/:id/contracts', async (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    const data = createContractSchema.parse(await c.req.json());

    const contract = new EventServiceEntity({
      id: `ctr-${crypto.randomUUID().slice(0, 8)}`,
      eventId: event.id,
      serviceId: data.serviceId,
      serviceName: data.serviceName,
      vendorName: data.vendorName,
      category: data.category,
      agreedPrice: data.agreedPrice,
      notes: data.notes,
      status: 'contracted'
    });
    store.contracts.set(contract.id, contract);

    let generatedExpense: ExpenseEntity | null = null;
    if (data.autoGenerateExpense) {
      generatedExpense = contract.generateExpense(`exp-${crypto.randomUUID().slice(0, 8)}`);
      store.expenses.set(generatedExpense.id, generatedExpense);
    }

    return c.json({ contract, generatedExpense }, 201);
  });

  app.post('/api/v1/events/:id/contracts/:contractId/document', async (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    const contract = store.contracts.get(c.req.param('contractId'));

    if (!contract || contract.eventId !== event.id) {
      throw new NotFoundError('Contrato no encontrado');
    }

    const { fileName, contentBase64 } = attachContractDocSchema.parse(await c.req.json());
    const key = `contracts/${event.id}/${contract.id}-${sanitizeFileName(fileName)}`;
    const stored = await storage.putObject(key, contentBase64, 'application/pdf');
    contract.attachContractDocument(key);

    return c.json({ contract, objectMeta: stored });
  });

  // Tareas Operativas
  app.get('/api/v1/events/:id/tasks', (c) => {
    const event = resolveAuthorizedEvent(c.req.param('id'), c.get('user'));
    const eventTasks = Array.from(store.tasks.values()).filter((t) => t.eventId === event.id);
    return c.json({
      tasks: eventTasks,
      overdue: getOverdueTasks(eventTasks),
      progress: event.calculateProgress(eventTasks)
    });
  });

  app.post('/api/v1/events/:id/tasks', async (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    const data = createTaskSchema.parse(await c.req.json());

    const task = new TaskEntity({
      id: `tsk-${crypto.randomUUID().slice(0, 8)}`,
      eventId: event.id,
      assignedTo: data.assignedTo ?? user.userId,
      title: data.title,
      description: data.description,
      priority: data.priority,
      status: 'todo',
      dueDate: data.dueDate
    });
    store.tasks.set(task.id, task);

    const eventTasks = Array.from(store.tasks.values()).filter((t) => t.eventId === event.id);
    return c.json({ task, progress: event.calculateProgress(eventTasks) }, 201);
  });

  app.patch('/api/v1/events/:id/tasks/:taskId/complete', (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    const task = store.tasks.get(c.req.param('taskId'));

    if (!task || task.eventId !== event.id) {
      throw new NotFoundError('Tarea no encontrada');
    }

    task.completeTask();
    const eventTasks = Array.from(store.tasks.values()).filter((t) => t.eventId === event.id);
    return c.json({ task, progress: event.calculateProgress(eventTasks) });
  });

  // Cronograma Minuto a Minuto y Detección de Conflictos (CP-AGE-04)
  app.post('/api/v1/events/:id/agenda', async (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    const data = createAgendaItemSchema.parse(await c.req.json());

    const currentItems = Array.from(store.agendaItems.values()).filter(
      (a) => a.eventId === event.id
    );

    const candidate = new AgendaItemEntity({
      id: `agd-${crypto.randomUUID().slice(0, 8)}`,
      eventId: event.id,
      title: data.title,
      startTime: data.startTime,
      endTime: data.endTime,
      responsiblePerson: data.responsiblePerson,
      locationDetail: data.locationDetail,
      notes: data.notes,
      orderIndex: currentItems.length
    });

    const conflicts = detectTimelineConflicts([...currentItems, candidate]);
    if (conflicts.length > 0) {
      throw new ConflictError(conflicts[0].reason);
    }

    store.agendaItems.set(candidate.id, candidate);
    return c.json({ item: candidate }, 201);
  });

  app.put('/api/v1/events/:id/agenda/reorder', async (c) => {
    const user = c.get('user');
    assertRole(user, ['admin', 'organizer']);
    const event = resolveAuthorizedEvent(c.req.param('id'), user);
    const { orderedIds } = reorderAgendaSchema.parse(await c.req.json());

    const currentItems = Array.from(store.agendaItems.values()).filter(
      (a) => a.eventId === event.id
    );
    const reordered = reorderTimeline(currentItems, orderedIds);
    for (const updated of reordered) {
      const entity = store.agendaItems.get(updated.id);
      if (entity) {
        entity.reposition(updated.orderIndex);
      }
    }

    return c.json({
      agenda: Array.from(store.agendaItems.values())
        .filter((a) => a.eventId === event.id)
        .sort((a, b) => a.orderIndex - b.orderIndex)
    });
  });

  return app;
}
