// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { PlanoraApiClient } from '../src/services/apiClient';
import type { EventDetailResponse } from '../src/types';

function createSelfContainedMockApiClient(options?: {
  emptyEvents?: boolean;
  failGuestSave?: boolean;
  onAddGuestPayload?: (payload: Record<string, unknown>) => void;
}): PlanoraApiClient {
  let currentRole: 'organizer' | 'client' = 'organizer';
  let spent = 360000;
  let taskCompleted = false;
  const guests: EventDetailResponse['guests'] = [
    {
      id: 'gst-1',
      eventId: 'evt-1',
      firstName: 'Elena',
      lastName: 'Villarreal',
      fullName: 'Elena Villarreal',
      email: 'elena@correo.mx',
      phone: '',
      tableNumber: 4,
      rsvpStatus: 'confirmed',
      plusOnes: 3,
      totalSeats: 4,
      mealPreference: 'standard',
      allergies: 'Mariscos',
      hasCriticalAllergies: true,
      dietaryRestrictions: 'Utensilios separados'
    }
  ];

  const jsonRes = (data: unknown, status = 200) =>
    Promise.resolve(
      new Response(status === 204 ? null : JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
      })
    );

  return new PlanoraApiClient('/api/v1', async (url, init) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : {};

    if (url.endsWith('/auth/login') && method === 'POST') {
      if (body.password !== 'Planora2026!') {
        return jsonRes({ error: 'UNAUTHORIZED', message: 'Credenciales inválidas' }, 401);
      }
      currentRole = String(body.email).includes('cliente') ? 'client' : 'organizer';
      return jsonRes({
        token: 'mock-jwt-token',
        user: {
          id: currentRole === 'client' ? 'u-client' : 'u-org',
          name: currentRole === 'client' ? 'Sofía Villarreal' : 'Federico Z. (Planner)',
          email: body.email,
          role: currentRole
        }
      });
    }

    if (url.endsWith('/auth/logout') && method === 'POST') {
      return jsonRes(null, 204);
    }

    if (url.endsWith('/auth/me') && method === 'GET') {
      return jsonRes({
        user: {
          id: currentRole === 'client' ? 'u-client' : 'u-org',
          name: currentRole === 'client' ? 'Sofía Villarreal' : 'Federico Z. (Planner)',
          email: currentRole === 'client' ? 'sofia@cliente.mx' : 'organizer@planora.mx',
          role: currentRole
        }
      });
    }

    if (url.endsWith('/dashboard')) {
      return jsonRes({
        totalEvents: 3,
        confirmedEvents: 2,
        draftEvents: 1,
        totalBudgetVolume: 1420000,
        totalSpentVolume: spent,
        overallExecutionPct: 69,
        totalConfirmedAttendees: 214,
        totalTablesCount: 4,
        totalCriticalAllergies: 4,
        contractsInR2: 3
      });
    }

    if (url.endsWith('/events') && method === 'GET') {
      if (options?.emptyEvents) {
        return jsonRes({ events: [] });
      }
      return jsonRes({
        events: [
          {
            id: 'evt-1',
            title: 'Boda Sofía Villarreal & Mateo Alarcón',
            eventType: 'wedding',
            status: 'confirmed',
            eventDate: '2026-11-24T18:00:00.000Z',
            venueName: 'Hacienda San Gabriel',
            initialBudget: 500000,
            estimatedGuests: 240,
            clientId: 'cli-1',
            clientName: 'Sofía Villarreal',
            clientEmail: 'sofia@cliente.mx',
            confirmedSeats: 24,
            progress: taskCompleted ? 100 : 75,
            budgetStatus: spent >= 450000 ? 'yellow' : 'green',
            spentPercentage: Number(((spent / 500000) * 100).toFixed(0))
          }
        ]
      });
    }

    if (url.includes('/events/evt-1') && method === 'GET') {
      const pct = Number(((spent / 500000) * 100).toFixed(0));
      const detail: EventDetailResponse = {
        event: {
          id: 'evt-1',
          title: 'Boda Sofía Villarreal & Mateo Alarcón',
          eventType: 'wedding',
          status: 'confirmed',
          eventDate: '2026-11-24T18:00:00.000Z',
          venueName: 'Hacienda San Gabriel',
          venueAddress: 'Morelos',
          initialBudget: 500000,
          estimatedGuests: 240,
          clientName: 'Sofía Villarreal',
          clientEmail: 'sofia@cliente.mx',
          progress: taskCompleted ? 100 : 75
        },
        budget: {
          initialBudget: 500000,
          totalSpent: spent,
          paidAmount: 310000,
          pendingAmount: spent - 310000,
          remainingBalance: 500000 - spent,
          spentPercentage: pct,
          statusAlert: pct >= 90 ? 'yellow' : 'green',
          isOverrun: false
        },
        rsvpMetrics: {
          totalInvitedGuests: guests.length,
          confirmedGuests: guests.length,
          pendingGuests: 0,
          declinedGuests: 0,
          totalConfirmedSeats: 24,
          confirmationRate: 100
        },
        cateringReport: {
          totalsByMenu: { standard: 14, vegetarian: 6, vegan: 4 },
          platesByTable: { 4: 10, 9: 8 },
          criticalAlerts: [{ guestId: 'gst-1', tableNumber: 4, allergen: 'Mariscos' }],
          enrichedAlerts: [
            {
              guestId: 'gst-1',
              guestName: 'Elena Villarreal',
              tableNumber: 4,
              allergen: 'Mariscos',
              dietaryRestrictions: 'Utensilios separados'
            }
          ]
        },
        tables: [
          {
            id: 'tbl-9',
            eventId: 'evt-1',
            tableNumber: 9,
            label: 'Mesa 09 • Corporativos',
            capacity: 10,
            seated: 8,
            availableSeats: 2
          }
        ],
        guests,
        expenses: [],
        contracts: [
          {
            id: 'ctr-1',
            eventId: 'evt-1',
            serviceName: 'Renta Hacienda San Gabriel',
            vendorName: 'Hacienda S.A.',
            category: 'venue',
            agreedPrice: 165000,
            status: 'paid',
            contractUrl: 'contracts/evt-1/hacienda.pdf'
          }
        ],
        tasks: [
          {
            id: 'tsk-3',
            eventId: 'evt-1',
            title: 'Confirmar últimos pendientes RSVP',
            priority: 'high',
            status: taskCompleted ? 'completed' : 'in_progress',
            dueDate: '2026-11-18'
          }
        ],
        agenda: [
          {
            id: 'agd-2',
            eventId: 'evt-1',
            title: 'Recepción y Cóctel',
            startTime: '19:00',
            endTime: '20:00',
            responsiblePerson: 'Capitán',
            locationDetail: 'Jardín Principal',
            notes: '',
            orderIndex: 0
          }
        ]
      };
      return jsonRes(detail);
    }

    if (url.endsWith('/clone') && method === 'POST') {
      return jsonRes({ event: { id: 'evt-cloned' } }, 201);
    }

    if (url.endsWith('/guests') && method === 'POST') {
      options?.onAddGuestPayload?.(body);
      if (options?.failGuestSave) {
        return jsonRes({ error: 'VALIDATION_ERROR', message: 'Error simulado al guardar RSVP' }, 400);
      }
      if (body.tableNumber === 9 && 8 + 1 + Number(body.plusOnes) > 10) {
        return jsonRes(
          {
            error: 'TABLE_CAPACITY_EXCEEDED',
            message: 'La Mesa 9 no tiene cupo suficiente'
          },
          422
        );
      }
      const created = {
        id: 'gst-new',
        eventId: 'evt-1',
        firstName: body.firstName,
        lastName: body.lastName ?? '',
        fullName: `${body.firstName} ${body.lastName ?? ''}`.trim(),
        email: '',
        phone: '',
        tableNumber: body.tableNumber ?? null,
        rsvpStatus: body.rsvpStatus,
        plusOnes: body.plusOnes,
        totalSeats: 1 + Number(body.plusOnes),
        mealPreference: body.mealPreference ?? 'standard',
        allergies: body.allergies ?? '',
        hasCriticalAllergies: Boolean(body.hasCriticalAllergies),
        dietaryRestrictions: ''
      };
      guests.push(created);
      return jsonRes({ guestId: created.id, guest: created }, 201);
    }

    if (url.endsWith('/expenses') && method === 'POST') {
      if (currentRole === 'client') {
        return jsonRes(
          { error: 'FORBIDDEN', message: 'El rol client no puede registrar gastos' },
          403
        );
      }
      spent += Number(body.amount);
      return jsonRes({ expense: { id: 'exp-new' }, budget: { totalSpent: spent } }, 201);
    }

    if (url.includes('/tasks/') && url.endsWith('/complete') && method === 'PATCH') {
      taskCompleted = true;
      return jsonRes({ task: { id: 'tsk-3', status: 'completed' }, progress: 100 });
    }

    if (url.endsWith('/agenda') && method === 'POST') {
      return jsonRes(
        {
          error: 'CONFLICT',
          message: 'Solapamiento en locación "Jardín Principal" (19:30 – 20:00)'
        },
        409
      );
    }

    if (url.includes('/apm/test')) {
      if (url.includes('mode=error')) {
        return jsonRes(
          {
            error: 'INTERNAL_SERVER_ERROR',
            message: 'APM_SIMULATED_ERROR: Excepción controlada para verificación de monitoreo APM en Sentry',
            traceId: 'trace-mock-err-1',
            sentryEventId: 'sentry-mock-err-1'
          },
          500
        );
      }
      return jsonRes({
        apm: 'recorded',
        mode: 'message',
        traceId: 'trace-mock-msg-1',
        sentryEnabled: true,
        sentryEventId: 'sentry-mock-msg-1',
        message: 'Mensaje y traza registrados correctamente en telemetría Sentry',
        timestamp: new Date().toISOString()
      });
    }

    return jsonRes({ status: 'ok' });
  });
}

describe('Frontend SPA — Login Minimalista, Modo Oscuro/Claro y Portales por Rol', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.documentElement.setAttribute('data-theme', 'dark');
    let meta = document.querySelector('meta[name="color-scheme"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'color-scheme');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'dark');
  });

  it('inicia en Modo Oscuro por defecto, alterna a Modo Claro con el botón Sol/Luna y valida Login simplificado', async () => {
    const user = userEvent.setup();
    const apiClient = createSelfContainedMockApiClient();
    render(<App apiClient={apiClient} />);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(screen.getByRole('heading', { name: /Iniciar Sesión/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Correo Electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: /Cambiar a modo claro/i });
    await user.click(toggleBtn);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe(
      'light'
    );

    const backDarkBtn = screen.getByRole('button', { name: /Cambiar a modo oscuro/i });
    await user.click(backDarkBtn);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    const emailInput = screen.getByLabelText(/Correo Electrónico/i);
    await user.type(emailInput, 'correo-invalido');
    fireEvent.blur(emailInput);
    expect(screen.getByText(/formato válido/i)).toBeInTheDocument();

    await user.clear(emailInput);
    await user.type(emailInput, 'organizer@planora.mx');
    expect(screen.queryByText(/formato válido/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Contraseña/i), 'ClaveIncorrecta');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Credenciales inválidas/i);
  });

  it('enruta automáticamente a Portal Admin para rol organizer y ejecuta los 6 módulos operativos', async () => {
    const user = userEvent.setup();
    const apiClient = createSelfContainedMockApiClient();
    render(<App apiClient={apiClient} />);

    await user.type(screen.getByLabelText(/Correo Electrónico/i), 'organizer@planora.mx');
    await user.type(screen.getByLabelText(/Contraseña/i), 'Planora2026!');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(
      await screen.findByRole('heading', { name: /Dashboard Ejecutivo/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /2\. Eventos & Clientes/i }));
    await user.click(screen.getByRole('button', { name: /Clonar Plantilla de Evento/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Estructura clonada con éxito/i);

    await user.click(screen.getByRole('button', { name: /3\. Invitados & Mesas/i }));
    await user.click(screen.getByRole('button', { name: /Asignar a Mesa/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no tiene cupo suficiente/i);

    await user.click(screen.getByRole('button', { name: /4\. Catering & Alergias/i }));
    expect(
      screen.getByRole('heading', { name: /Reporte Consolidado de Menús/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /5\. Presupuesto & R2/i }));
    expect(screen.getByText(/VERDE \(72%\)/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /\+ Registrar/i }));
    await waitFor(() => {
      expect(screen.getByText(/AMARILLO \(94%\)/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /6\. Tareas & Cronograma/i }));
    const completeBtns = screen.getAllByRole('button', { name: 'Completar' });
    await user.click(completeBtns[0]);
    await waitFor(() => {
      expect(screen.getByText(/100% Completado/i)).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', { name: /Agregar Bloque al Cronograma/i })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/Solapamiento/i);

    await user.click(screen.getByRole('button', { name: /Cerrar Sesión/i }));
    expect(await screen.findByRole('heading', { name: /Iniciar Sesión/i })).toBeInTheDocument();
  });

  it('enruta automáticamente a Portal Cliente para rol client, bloquea gastos con 403 y permite RSVP', async () => {
    const user = userEvent.setup();
    const apiClient = createSelfContainedMockApiClient();
    render(<App apiClient={apiClient} />);

    await user.type(screen.getByLabelText(/Correo Electrónico/i), 'sofia@cliente.mx');
    await user.type(screen.getByLabelText(/Contraseña/i), 'Planora2026!');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText(/Portal Exclusivo del Cliente/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Verificar protección RBAC/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/HTTP 403 Forbidden/i);

    await user.click(screen.getByRole('button', { name: /2\. Mis Invitados, RSVP & Alergias/i }));
    await user.click(screen.getByRole('button', { name: /\+ Guardar Confirmación/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/Confirmación guardada/i);

    await user.click(screen.getByRole('button', { name: /3\. Mapa de Mis Mesas/i }));
    expect(screen.getByText(/Distribución de Mesas de Mi Evento/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /4\. Mi Cronograma & Contratos/i }));
    expect(
      screen.getByText(/Itinerario Minuto a Minuto de Nuestro Gran Día/i)
    ).toBeInTheDocument();
  });

  it('mantiene la sesión en pantalla vacía si el usuario tiene 0 eventos', async () => {
    const user = userEvent.setup();
    const emptyApi = createSelfContainedMockApiClient({ emptyEvents: true });
    render(<App apiClient={emptyApi} />);

    await user.type(screen.getByLabelText(/Correo Electrónico/i), 'organizer@planora.mx');
    await user.type(screen.getByLabelText(/Contraseña/i), 'Planora2026!');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText(/Aún no tienes eventos asignados/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Cerrar Sesión/i }));
    expect(await screen.findByRole('heading', { name: /Iniciar Sesión/i })).toBeInTheDocument();
  });

  it('no marca alergia leve como crítica por defecto y muestra error si falla el guardado RSVP', async () => {
    const user = userEvent.setup();
    const capturedPayloads: Array<Record<string, unknown>> = [];
    const rsvpErrorApi = createSelfContainedMockApiClient({
      failGuestSave: true,
      onAddGuestPayload: (p) => capturedPayloads.push(p)
    });
    render(<App apiClient={rsvpErrorApi} />);

    await user.type(screen.getByLabelText(/Correo Electrónico/i), 'sofia@cliente.mx');
    await user.type(screen.getByLabelText(/Contraseña/i), 'Planora2026!');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await user.click(await screen.findByRole('button', { name: /2\. Mis Invitados, RSVP & Alergias/i }));
    await user.click(screen.getByRole('button', { name: /\+ Guardar Confirmación/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Error simulado al guardar RSVP/i);
    expect(capturedPayloads[0]?.hasCriticalAllergies).toBe(false);
  });

  it('permite verificar Trazas, Mensajes y Errores APM desde el Dashboard de AdminPortal', async () => {
    const user = userEvent.setup();
    const apiClient = createSelfContainedMockApiClient();
    render(<App apiClient={apiClient} />);

    await user.type(screen.getByLabelText(/Correo Electrónico/i), 'organizer@planora.mx');
    await user.type(screen.getByLabelText(/Contraseña/i), 'Planora2026!');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText(/Monitoreo de Trazas, Errores y Mensajes/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Enviar Traza \+ Mensaje APM/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Traza y mensaje APM registrados/i);

    await user.click(screen.getByRole('button', { name: /Probar Error Frontend \(Sentry\)/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Error controlado capturado/i);

    await user.click(screen.getByRole('button', { name: /Probar Error Backend \(Sentry\)/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/APM_SIMULATED_ERROR/i);
  });
});
