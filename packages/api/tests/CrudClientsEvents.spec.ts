import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { EventEntity } from '../src/domain/entities/EventEntity';
import { ClientEntity } from '../src/domain/entities/UserAndClient';
import { DomainError, ValidationError } from '../src/domain/errors';
import { signTestToken } from './fakes/tokens';

const secret = 'crud-secret';

async function authHeaders(userId: string, role: 'admin' | 'organizer' | 'client') {
  const token = await signTestToken({ userId, role }, secret);
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

describe('CRUD de Clientes — Create, Read, Update y Delete', () => {
  it('crea, consulta, actualiza y elimina un cliente del organizador', async () => {
    const app = createApp({ jwtSecret: secret });
    const headers = await authHeaders('u-org', 'organizer');

    const createRes = await app.request('/api/v1/clients', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        firstName: 'Laura',
        lastName: 'Méndez',
        email: 'laura@example.com',
        phone: '3311223344'
      })
    });
    expect(createRes.status).toBe(201);
    const { client } = await createRes.json();

    const updateRes = await app.request(`/api/v1/clients/${client.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ phone: '3399887766', notes: 'Prefiere contacto por WhatsApp' })
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()).client;
    expect(updated.phone).toBe('3399887766');
    expect(updated.notes).toBe('Prefiere contacto por WhatsApp');
    expect(updated.firstName).toBe('Laura');

    const readRes = await app.request(`/api/v1/clients/${client.id}`, { headers });
    expect((await readRes.json()).client.phone).toBe('3399887766');

    const deleteRes = await app.request(`/api/v1/clients/${client.id}`, {
      method: 'DELETE',
      headers
    });
    expect(deleteRes.status).toBe(204);

    const afterDelete = await app.request(`/api/v1/clients/${client.id}`, { headers });
    expect(afterDelete.status).toBe(404);
  });

  it('rechaza actualizaciones vacías (400) y clientes de otro organizador (404)', async () => {
    const app = createApp({ jwtSecret: secret });
    const headers = await authHeaders('u-org', 'organizer');

    const emptyRes = await app.request('/api/v1/clients/cli-1', {
      method: 'PUT',
      headers,
      body: JSON.stringify({})
    });
    expect(emptyRes.status).toBe(400);

    const foreignRes = await app.request('/api/v1/clients/cli-de-org-b', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ notes: 'intento' })
    });
    expect(foreignRes.status).toBe(404);
  });

  it('el rol client no puede actualizar clientes (403)', async () => {
    const app = createApp({ jwtSecret: secret });
    const res = await app.request('/api/v1/clients/cli-1', {
      method: 'PUT',
      headers: await authHeaders('u-client', 'client'),
      body: JSON.stringify({ notes: 'hola' })
    });
    expect(res.status).toBe(403);
  });
});

describe('CRUD de Eventos — Update (PATCH) y Delete', () => {
  it('actualiza los datos de un evento y los refleja en la consulta', async () => {
    const app = createApp({ jwtSecret: secret });
    const headers = await authHeaders('u-org', 'organizer');

    const patchRes = await app.request('/api/v1/events/evt-3', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ venueName: 'Hacienda Santa Lucía', initialBudget: 250000 })
    });
    expect(patchRes.status).toBe(200);
    const { event } = await patchRes.json();
    expect(event.venueName).toBe('Hacienda Santa Lucía');
    expect(event.initialBudget).toBe(250000);
  });

  it('elimina un evento en borrador junto con sus registros dependientes', async () => {
    const app = createApp({ jwtSecret: secret });
    const headers = await authHeaders('u-org', 'organizer');

    const createRes = await app.request('/api/v1/events', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clientId: 'cli-1',
        title: 'Evento temporal',
        eventDate: '2027-06-20',
        venueName: 'Salón Demo',
        initialBudget: 10000
      })
    });
    expect(createRes.status).toBe(201);
    const { event } = await createRes.json();

    const deleteRes = await app.request(`/api/v1/events/${event.id}`, {
      method: 'DELETE',
      headers
    });
    expect(deleteRes.status).toBe(204);

    const afterDelete = await app.request(`/api/v1/events/${event.id}`, { headers });
    expect(afterDelete.status).toBe(404);
  });

  it('no permite eliminar un evento confirmado (422)', async () => {
    const app = createApp({ jwtSecret: secret });
    const res = await app.request('/api/v1/events/evt-1', {
      method: 'DELETE',
      headers: await authHeaders('u-org', 'organizer')
    });
    expect(res.status).toBe(422);
  });
});

describe('Reglas de dominio de actualización', () => {
  it('ClientEntity.updateProfile exige nombre y teléfono', () => {
    const client = new ClientEntity({
      id: 'c-1',
      organizerId: 'u-org',
      firstName: 'Ana',
      lastName: 'Ruiz',
      email: 'ANA@EXAMPLE.COM',
      phone: '3312345678'
    });
    client.updateProfile({ email: 'Nuevo@Example.com', lastName: ' Pérez ' });
    expect(client.email).toBe('nuevo@example.com');
    expect(client.lastName).toBe('Pérez');
    expect(() => client.updateProfile({ phone: '   ' })).toThrow(ValidationError);
  });

  it('EventEntity.updateDetails valida datos y bloquea eventos cancelados', () => {
    const event = new EventEntity({
      id: 'e-1',
      clientId: 'c-1',
      title: 'Boda',
      eventDate: '2027-01-10',
      initialBudget: 1000
    });
    event.updateDetails({ eventDate: '2027-02-14', estimatedGuests: 150, eventType: 'social' });
    expect(event.eventDate.toISOString().startsWith('2027-02-14')).toBe(true);
    expect(event.estimatedGuests).toBe(150);
    expect(event.eventType).toBe('social');

    expect(() => event.updateDetails({ title: '  ' })).toThrow(ValidationError);
    expect(() => event.updateDetails({ initialBudget: -1 })).toThrow(ValidationError);
    expect(() => event.updateDetails({ eventDate: 'no-es-fecha' })).toThrow(ValidationError);

    event.cancelEvent('El cliente pospuso el evento');
    expect(() => event.updateDetails({ venueName: 'Otra sede' })).toThrow(DomainError);
    expect(() => event.ensureCanBeDeleted()).not.toThrow();
  });
});
