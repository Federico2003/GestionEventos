import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { RateLimiterPort } from '../src/infrastructure/ports';
import { InMemoryTelemetry } from '../src/infrastructure/telemetry';

/** Simula el binding ratelimits de Workers: `limit` peticiones por llave. */
class FakeRateLimiter implements RateLimiterPort {
  public readonly keys: string[] = [];
  private readonly counts = new Map<string, number>();

  constructor(private readonly max: number) {}

  public async limit({ key }: { key: string }): Promise<{ success: boolean }> {
    this.keys.push(key);
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return { success: count <= this.max };
  }
}

function login(app: ReturnType<typeof createApp>, ip: string) {
  return app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify({ email: 'nadie@planora.mx', password: 'incorrecta' })
  });
}

describe('Rate limiting en /api/v1/auth/* (CP-SEC-05 escenario de fuerza bruta)', () => {
  it('permite 10 intentos por IP y bloquea el 11 con 429 y Retry-After', async () => {
    const limiter = new FakeRateLimiter(10);
    const telemetry = new InMemoryTelemetry();
    const app = createApp({ authRateLimiter: limiter, telemetry, jwtSecret: 'rate-limit-secret' });

    for (let i = 0; i < 10; i++) {
      expect((await login(app, '203.0.113.7')).status).toBe(401);
    }
    const blocked = await login(app, '203.0.113.7');
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('10');
    expect((await blocked.json()).error).toBe('TOO_MANY_REQUESTS');
    expect(telemetry.logs.some((l) => l.level === 'warn' && l.message.startsWith('Rate limit excedido'))).toBe(true);

    // Otra IP no se ve afectada
    expect((await login(app, '198.51.100.20')).status).toBe(401);
    expect(limiter.keys).toContain('auth:198.51.100.20');
  });

  it('no limita rutas fuera de /api/v1/auth ni funciona sin binding', async () => {
    const limiter = new FakeRateLimiter(0);
    const app = createApp({ authRateLimiter: limiter });
    expect((await app.request('/api/v1/health')).status).toBe(200);
    expect(limiter.keys).toEqual([]);

    const sinBinding = createApp({ jwtSecret: 'rate-limit-secret' });
    for (let i = 0; i < 12; i++) {
      expect((await login(sinBinding, '203.0.113.7')).status).toBe(401);
    }
  });
});
