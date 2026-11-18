import { count } from 'drizzle-orm';
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import { schema } from './schema';

/** Estado de la base de datos reportado por el healthcheck. */
export interface DatabaseStatus {
  provider: string;
  status: 'connected' | 'error' | 'not_configured';
  tables?: Record<string, number>;
  error?: string;
}

/** Binding de D1 tal como lo recibe el Worker (`env.DB`). */
export type D1Binding = Parameters<typeof drizzle>[0];

export interface DatabaseHealthPort {
  check(): Promise<DatabaseStatus>;
}

export class NotConfiguredDatabase implements DatabaseHealthPort {
  public async check(): Promise<DatabaseStatus> {
    return { provider: 'in-memory', status: 'not_configured' };
  }
}

/** Adaptador de Cloudflare D1 con Drizzle ORM (binding `DB` del Worker). */
export class D1DatabaseHealth implements DatabaseHealthPort {
  private readonly db: DrizzleD1Database<typeof schema>;

  constructor(binding: D1Binding) {
    this.db = drizzle(binding, { schema });
  }

  public async check(): Promise<DatabaseStatus> {
    try {
      const [users] = await this.db.select({ n: count() }).from(schema.users);
      const [events] = await this.db.select({ n: count() }).from(schema.events);
      const [guests] = await this.db.select({ n: count() }).from(schema.guests);
      return {
        provider: 'cloudflare-d1',
        status: 'connected',
        tables: { users: users?.n ?? 0, events: events?.n ?? 0, guests: guests?.n ?? 0 }
      };
    } catch (error) {
      return {
        provider: 'cloudflare-d1',
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
