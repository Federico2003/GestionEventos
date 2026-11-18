import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { signTestToken } from './fakes/tokens';

describe('API REST & Validación Zod — Flujos Integrales de Planora', () => {
  const secret = 'integration-secret';
  const app = createApp({ jwtSecret: secret });

  it('expone endpoint público de salud /api/v1/health y telemetría APM /api/v1/apm/test', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-trace-id')).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('planora-api');

    const apmMsg = await app.request('/api/v1/apm/test?mode=message');
    expect(apmMsg.status).toBe(200);

    const apmErr = await app.request('/api/v1/apm/test?mode=error');
    expect(apmErr.status).toBe(500);
  });

  it('consulta dashboard, eventos, reporte de catering y vistas filtradas para rol client', async () => {
    const orgToken = await signTestToken({ userId: 'u-org', role: 'organizer' }, secret);
    const clientToken = await signTestToken({ userId: 'u-client', role: 'client' }, secret);

    const dashRes = await app.request('/api/v1/dashboard', {
      headers: { Authorization: `Bearer ${orgToken}` }
    });
    expect(dashRes.status).toBe(200);
    const dash = await dashRes.json();
    expect(dash.totalEvents).toBeGreaterThanOrEqual(3);

    const detailOrgRes = await app.request('/api/v1/events/evt-1', {
      headers: { Authorization: `Bearer ${orgToken}` }
    });
    expect(detailOrgRes.status).toBe(200);
    const detailOrg = await detailOrgRes.json();
    expect(detailOrg.expenses.length).toBeGreaterThan(0);

    const detailClientRes = await app.request('/api/v1/events/evt-1', {
      headers: { Authorization: `Bearer ${clientToken}` }
    });
    expect(detailClientRes.status).toBe(200);
    const detailClient = await detailClientRes.json();
    // El cliente ve el resumen macro pero no el desglose interno ni PII de otros invitados
    expect(detailClient.budget.initialBudget).toBe(500000);
    expect(detailClient.expenses).toEqual([]);
    expect(detailClient.tasks).toEqual([]);
    expect(detailClient.agendaConflicts).toEqual([]);
    expect(detailClient.guests.every((g: { email: string; phone: string }) => g.email === '' && g.phone === '')).toBe(true);
    expect(detailClient.contracts.every((ct: { agreedPrice: number }) => ct.agreedPrice === 0)).toBe(true);

    // El dashboard filtra contractsInR2 por inquilino
    const orgAToken = await signTestToken({ userId: 'u-org-a', role: 'organizer' }, secret);
    const dashOrgARes = await app.request('/api/v1/dashboard', {
      headers: { Authorization: `Bearer ${orgAToken}` }
    });
    expect(dashOrgARes.status).toBe(200);
    const dashOrgA = await dashOrgARes.json();
    expect(dashOrgA.contractsInR2).toBe(0);

    // Un cliente no puede asignar mesa al crear invitado (403)
    const clientAssignRes = await app.request('/api/v1/events/evt-1/guests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${clientToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Invitado',
        lastName: 'SinPermiso',
        rsvpStatus: 'confirmed',
        plusOnes: 0,
        tableNumber: 15
      })
    });
    expect(clientAssignRes.status).toBe(403);

    const catRes = await app.request('/api/v1/events/evt-1/catering-report', {
      headers: { Authorization: `Bearer ${orgToken}` }
    });
    expect(catRes.status).toBe(200);
    const catBody = await catRes.json();
    expect(catBody.report.criticalAlerts.length).toBeGreaterThanOrEqual(4);
  });

  it('valida cargas útiles con Zod (400), bloqueo de sobrecupo (422) y conflictos de agenda (409)', async () => {
    const orgToken = await signTestToken({ userId: 'u-org', role: 'organizer' }, secret);
    const headers = {
      Authorization: `Bearer ${orgToken}`,
      'Content-Type': 'application/json'
    };

    // 1. Zod rechaza gasto con monto negativo -> 400
    const badExpense = await app.request('/api/v1/events/evt-1/expenses', {
      method: 'POST',
      headers,
      body: JSON.stringify({ concept: 'Error', category: 'catering', amount: -500 })
    });
    expect(badExpense.status).toBe(400);

    // 2. Bloqueo de sobrecupo en Mesa 09 (tiene 8/10 ocupados, grupo de 1+2=3 -> 422)
    const overCapRes = await app.request('/api/v1/events/evt-1/guests', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        firstName: 'Familia',
        lastName: 'Numerosa',
        rsvpStatus: 'confirmed',
        plusOnes: 2,
        tableNumber: 9
      })
    });
    expect(overCapRes.status).toBe(422);

    // No se puede sentar a un invitado con RSVP declinado -> 400
    const declinedSeatRes = await app.request('/api/v1/events/evt-1/guests', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        firstName: 'No',
        lastName: 'Asiste',
        rsvpStatus: 'declined',
        plusOnes: 0,
        tableNumber: 15
      })
    });
    expect(declinedSeatRes.status).toBe(400);

    // 3. Alta válida de invitado en Mesa 15 (tiene 6/10 ocupados, grupo de 1+1=2 -> 201)
    const okGuestRes = await app.request('/api/v1/events/evt-1/guests', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        firstName: 'Camila',
        lastName: 'Torres',
        rsvpStatus: 'confirmed',
        plusOnes: 1,
        tableNumber: 15,
        mealPreference: 'vegetarian'
      })
    });
    expect(okGuestRes.status).toBe(201);

    // 4. Conflicto horario en Jardín Principal (19:00-20:00 ya existe -> 19:30-20:30 da 409)
    const conflictRes = await app.request('/api/v1/events/evt-1/agenda', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Prueba de Audio Empalmada',
        startTime: '19:30',
        endTime: '20:30',
        responsiblePerson: 'Técnico Externo',
        locationDetail: 'Jardín Principal'
      })
    });
    expect(conflictRes.status).toBe(409);
  });

  it('permite clonar evento, gestionar proveedores, contratos R2, pagos y completar tareas', async () => {
    const orgToken = await signTestToken({ userId: 'u-org', role: 'organizer' }, secret);
    const headers = {
      Authorization: `Bearer ${orgToken}`,
      'Content-Type': 'application/json'
    };

    // Confirmar evento en borrador evt-3
    const confirmRes = await app.request('/api/v1/events/evt-3/confirm', {
      method: 'POST',
      headers
    });
    expect(confirmRes.status).toBe(200);

    // Clonar estructura de evt-1
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const cloneRes = await app.request('/api/v1/events/evt-1/clone', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Boda Clonada Plantilla 2027',
        eventDate: nextYear.toISOString()
      })
    });
    expect(cloneRes.status).toBe(201);
    const clonedBody = await cloneRes.json();
    expect(clonedBody.event.status).toBe('draft');
    expect(clonedBody.expenses.length).toBe(0);
    expect(clonedBody.tasks.length).toBeGreaterThan(0);

    // Crear proveedor y contrato con autogeneración de gasto + adjunto PDF en R2
    const vendorRes = await app.request('/api/v1/vendors', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        businessName: 'Foto Cinema Arte',
        category: 'photography',
        contactName: 'Valeria Ruiz',
        email: 'valeria@fotocinema.mx',
        phone: '+52 55 9090 1010',
        rating: 4.9
      })
    });
    expect(vendorRes.status).toBe(201);

    const contractRes = await app.request(`/api/v1/events/${clonedBody.event.id}/contracts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        serviceId: 'srv-photo-1',
        serviceName: 'Cobertura Documental 12 Horas',
        vendorName: 'Foto Cinema Arte',
        category: 'photography',
        agreedPrice: 42000,
        autoGenerateExpense: true
      })
    });
    expect(contractRes.status).toBe(201);
    const { contract, generatedExpense } = await contractRes.json();

    const docRes = await app.request(
      `/api/v1/events/${clonedBody.event.id}/contracts/${contract.id}/document`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ fileName: 'contrato-foto.pdf' })
      }
    );
    expect(docRes.status).toBe(200);

    // Liquidar gasto generado subiendo comprobante a R2
    const payRes = await app.request(
      `/api/v1/events/${clonedBody.event.id}/expenses/${generatedExpense.id}/pay`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ receiptFileName: 'comprobante-spei.pdf' })
      }
    );
    expect(payRes.status).toBe(200);

    // Completar tarea en el evento clonado
    const firstTaskId = clonedBody.tasks[0].id;
    const taskCompleteRes = await app.request(
      `/api/v1/events/${clonedBody.event.id}/tasks/${firstTaskId}/complete`,
      {
        method: 'PATCH',
        headers
      }
    );
    expect(taskCompleteRes.status).toBe(200);
    const taskCompleteBody = await taskCompleteRes.json();
    expect(taskCompleteBody.progress).toBeGreaterThan(0);
  });
});
