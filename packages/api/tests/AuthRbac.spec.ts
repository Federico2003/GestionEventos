import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { PlanoraDataStore } from '../src/infrastructure/store';
import { hashPassword, signJwt, verifyPassword } from '../src/security/jwt';
import { InMemoryKV } from './fakes/InMemoryKV';
import { signTestToken } from './fakes/tokens';

describe('CP-SEC-05: Auth & RBAC — JWT, permisos por rol y logout con KV', () => {
  const kv = new InMemoryKV();
  const app = createApp({ kv, jwtSecret: 'test-secret' });

  it('Escenario 5.1: autentica credenciales reales y emite JWT válido con rol correspondiente', async () => {
    const loginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'organizer@planora.mx', password: 'Planora2026!' })
    });

    expect(loginRes.status).toBe(200);
    const payload = await loginRes.json();
    expect(payload.token).toBeTruthy();
    expect(payload.user.role).toBe('organizer');

    const badRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'organizer@planora.mx', password: 'WrongPassword!' })
    });
    expect(badRes.status).toBe(401);
  });

  it('Escenario 5.2: un usuario client recibe 403 al registrar un gasto', async () => {
    const token = await signTestToken({ userId: 'u-client', role: 'client' }, 'test-secret');
    const res = await app.request('/api/v1/events/evt-1/expenses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ concept: 'Banquete', amount: 1000, category: 'catering' })
    });
    expect(res.status).toBe(403);
  });

  it('Escenario 5.3: un organizador no puede ver clientes de otro organizador (404)', async () => {
    const tokenA = await signTestToken({ userId: 'u-org-a', role: 'organizer' }, 'test-secret');
    const res = await app.request('/api/v1/clients/cli-de-org-b', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    expect(res.status).toBe(404);
  });

  it('Escenario 5.4: un token revocado en logout responde 401 en peticiones posteriores', async () => {
    const token = await signTestToken(
      { userId: 'u-org', role: 'organizer', jti: 'jti-123' },
      'test-secret'
    );
    const auth = { Authorization: `Bearer ${token}` };

    const logout = await app.request('/api/v1/auth/logout', { method: 'POST', headers: auth });
    expect(logout.status).toBe(204);
    expect(await kv.get('blacklist:jti-123')).not.toBeNull();

    const res = await app.request('/api/v1/events', { headers: auth });
    expect(res.status).toBe(401);
  });

  it('rechaza peticiones sin encabezado Authorization o con firma inválida (401)', async () => {
    const noAuth = await app.request('/api/v1/events');
    expect(noAuth.status).toBe(401);

    const forgedAuth = await app.request('/api/v1/events', {
      headers: { Authorization: 'Bearer token.falso.invalido' }
    });
    expect(forgedAuth.status).toBe(401);
  });

  it('utiliza PBKDF2 con salt aleatorio por usuario y bloquea tokens con algoritmo o payload inválido (401)', async () => {
    const hash1 = await hashPassword('Planora2026!');
    const hash2 = await hashPassword('Planora2026!');
    expect(hash1.startsWith('pbkdf2$100000$')).toBe(true);
    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword('Planora2026!', hash1)).toBe(true);
    expect(await verifyPassword('ClaveMala', hash1)).toBe(false);

    // Token con alg=none debe dar 401
    const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const validBody = Buffer.from(
      JSON.stringify({ userId: 'u-org', role: 'organizer', jti: 'jti-none', exp: 9999999999 })
    ).toString('base64url');
    const noneRes = await app.request('/api/v1/events', {
      headers: { Authorization: `Bearer ${noneHeader}.${validBody}.fakesig` }
    });
    expect(noneRes.status).toBe(401);

    // Token con firma HMAC válida pero payload JSON corrupto -> 401 (no 500)
    const enc = new TextEncoder();
    const hsHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const badPayload = Buffer.from('no-es-json{{{').toString('base64url');
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode('test-secret'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = Buffer.from(
      await crypto.subtle.sign('HMAC', key, enc.encode(`${hsHeader}.${badPayload}`))
    ).toString('base64url');
    const malformedRes = await app.request('/api/v1/events', {
      headers: { Authorization: `Bearer ${hsHeader}.${badPayload}.${sig}` }
    });
    expect(malformedRes.status).toBe(401);
  });

  it('aísla creación de eventos multitenant, valida usuarios desactivados, CORS y secreto en producción', async () => {
    const store = new PlanoraDataStore();
    const isolatedApp = createApp({ store, jwtSecret: 'test-secret' });

    // Organizador A no puede crear un evento usando cliente del Organizador B
    const tokenA = await signJwt({ userId: 'u-org-a', role: 'organizer' }, 'test-secret');
    const crossEventRes = await isolatedApp.request('/api/v1/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'cli-de-org-b',
        title: 'Intento Cruzado Multitenant',
        eventType: 'wedding',
        eventDate: '2027-06-15T18:00:00.000Z',
        venueName: 'Sede Test',
        initialBudget: 100000,
        estimatedGuests: 50
      })
    });
    expect(crossEventRes.status).toBe(404);

    // Usuario desactivado pierde acceso aunque tenga JWT vigente
    const orgToken = await signJwt(
      { userId: 'u-org-a', role: 'organizer', email: 'orga@planora.mx', name: 'Org A' },
      'test-secret'
    );
    const meOk = await isolatedApp.request('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${orgToken}` }
    });
    expect(meOk.status).toBe(200);
    const meJson = await meOk.json();
    expect(meJson.user.id).toBe('u-org-a');

    store.users.get('u-org-a')?.deactivate();
    const meBlocked = await isolatedApp.request('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${orgToken}` }
    });
    expect(meBlocked.status).toBe(401);

    // CORS restringido: permite localhost:3000 y omite ACAO para orígenes externos
    const allowedOriginRes = await isolatedApp.request('/api/v1/health', {
      headers: { Origin: 'http://localhost:3000' }
    });
    expect(allowedOriginRes.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');

    const blockedOriginRes = await isolatedApp.request('/api/v1/health', {
      headers: { Origin: 'https://atacante.evil.com' }
    });
    expect(blockedOriginRes.headers.get('access-control-allow-origin')).toBeNull();

    // En producción sin JWT_SECRET debe fallar al inicializar
    expect(() => createApp({ isProduction: true })).toThrow(/JWT_SECRET/);
  });
});
