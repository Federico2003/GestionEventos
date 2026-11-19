import { describe, expect, it } from 'vitest';
import { createApp, sanitizeFileName } from '../src/app';
import { signTestToken } from './fakes/tokens';

const secret = 'revision-final-secret';

async function headers() {
  const token = await signTestToken({ userId: 'u-org', role: 'organizer' }, secret);
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

describe('PATCH /rsvp — actualización parcial del perfil dietético', () => {
  it('guarda alergias aunque no se envíe mealPreference y conserva el menú', async () => {
    const app = createApp({ jwtSecret: secret });
    const h = await headers();

    const created = await app.request('/api/v1/events/evt-1/guests', {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ firstName: 'Carmen', lastName: 'Ríos', mealPreference: 'vegan' })
    });
    expect(created.status).toBe(201);
    const { guest } = await created.json();

    const res = await app.request(`/api/v1/events/evt-1/guests/${guest.id}/rsvp`, {
      method: 'PATCH',
      headers: h,
      body: JSON.stringify({
        rsvpStatus: 'confirmed',
        plusOnes: 0,
        allergies: 'Mariscos',
        hasCriticalAllergies: true
      })
    });
    expect(res.status).toBe(200);
    const updated = (await res.json()).guest;
    expect(updated.allergies).toBe('Mariscos');
    expect(updated.hasCriticalAllergies).toBe(true);
    expect(updated.mealPreference).toBe('vegan');
  });
});

describe('sanitizeFileName — llaves seguras en R2', () => {
  it('elimina rutas, secuencias .. y caracteres no permitidos', () => {
    expect(sanitizeFileName('../../otro-evento/contrato.pdf')).toBe('contrato.pdf');
    expect(sanitizeFileName('C:\\temp\\recibo final.pdf')).toBe('recibo_final.pdf');
    expect(sanitizeFileName('factura..pdf')).toBe('factura.pdf');
    expect(sanitizeFileName('..')).toBe('archivo');
    expect(sanitizeFileName('contrato-fotografía.pdf')).toBe('contrato-fotograf_a.pdf');
  });
});
