import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import {
  D1DatabaseHealth,
  NotConfiguredDatabase,
  type D1Binding
} from '../src/infrastructure/db/d1';

function fakeD1(result: number | Error): D1Binding {
  const statement = {
    bind: () => statement,
    raw: async () => {
      if (result instanceof Error) throw result;
      return [[result]];
    },
    all: async () => {
      if (result instanceof Error) throw result;
      return { results: [{ n: result }] };
    },
    first: async () => ({ n: result }),
    run: async () => ({ success: true })
  };
  return { prepare: () => statement, batch: async () => [], exec: async () => ({}) } as unknown as D1Binding;
}

describe('Healthcheck — estado de la base de datos D1', () => {
  it('sin binding DB reporta not_configured', async () => {
    const app = createApp({ environment: 'dev' });
    const body = await (await app.request('/api/v1/health')).json();
    expect(body.database).toEqual({ provider: 'in-memory', status: 'not_configured' });
    expect(await new NotConfiguredDatabase().check()).toMatchObject({ status: 'not_configured' });
  });

  it('con D1 conectado reporta los conteos de tablas', async () => {
    const app = createApp({ environment: 'dev', database: new D1DatabaseHealth(fakeD1(7)) });
    const body = await (await app.request('/api/v1/health')).json();
    expect(body.database.provider).toBe('cloudflare-d1');
    expect(body.database.status).toBe('connected');
    expect(body.database.tables).toEqual({ users: 7, events: 7, guests: 7 });
  });

  it('si D1 falla, el healthcheck sigue respondiendo con status error', async () => {
    const health = new D1DatabaseHealth(fakeD1(new Error('D1_ERROR: no such table: users')));
    const status = await health.check();
    expect(status.status).toBe('error');
    expect(status.error).toContain('Failed query');
  });
});
