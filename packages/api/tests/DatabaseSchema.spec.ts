import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

const apiRoot = resolve(__dirname, '..');

function applyMigrations(db: Database.Database): void {
  const dir = resolve(apiRoot, 'migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(resolve(dir, file), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) db.exec(statement);
    }
  }
}

describe('Esquema D1 — migraciones de Drizzle y seed', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    applyMigrations(db);
  });

  it('las migraciones crean las 11 tablas del modelo', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((row) => (row as { name: string }).name)
      .sort();
    expect(tables).toEqual([
      'agenda_items',
      'clients',
      'event_services',
      'event_tables',
      'events',
      'expenses',
      'guests',
      'services',
      'tasks',
      'users',
      'vendors'
    ]);
  });

  it('crea índices en los campos de búsqueda frecuente', () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all()
      .map((row) => (row as { name: string }).name);
    expect(indexes).toEqual(
      expect.arrayContaining([
        'idx_users_email',
        'idx_clients_organizer',
        'idx_events_organizer',
        'idx_guests_event',
        'idx_tasks_event'
      ])
    );
  });

  it('el seed de ejemplo se carga respetando todas las llaves foráneas', () => {
    db.exec(readFileSync(resolve(apiRoot, 'seed/seed.sql'), 'utf8'));
    const count = (table: string) =>
      (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    expect(count('users')).toBeGreaterThan(0);
    expect(count('events')).toBeGreaterThan(0);
    expect(count('guests')).toBeGreaterThan(0);
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('no permite asignar un invitado a una mesa inexistente o de otro evento', () => {
    db.exec(`
      INSERT INTO users (id, name, email, password_hash, role) VALUES ('u1', 'Org', 'o@x.mx', 'h', 'organizer');
      INSERT INTO clients (id, organizer_id, first_name, last_name, email, phone) VALUES ('c1', 'u1', 'Ana', 'Ruiz', 'a@x.mx', '33');
      INSERT INTO events (id, organizer_id, client_id, title, event_type, event_date, venue_name) VALUES
        ('e1', 'u1', 'c1', 'Boda', 'wedding', '2027-01-10', 'Salón'),
        ('e2', 'u1', 'c1', 'XV', 'fifteen_years', '2027-02-10', 'Jardín');
      INSERT INTO event_tables (id, event_id, table_number, capacity) VALUES ('t1', 'e1', 1, 10);
    `);
    const insertGuest = db.prepare(
      "INSERT INTO guests (id, event_id, first_name, last_name, table_number) VALUES (?, ?, 'Luis', 'Paz', ?)"
    );

    expect(() => insertGuest.run('g1', 'e1', 1)).not.toThrow();
    expect(() => insertGuest.run('g2', 'e1', 99)).toThrow(/FOREIGN KEY/);
    expect(() => insertGuest.run('g3', 'e2', 1)).toThrow(/FOREIGN KEY/);
    expect(() => insertGuest.run('g4', 'e2', null)).not.toThrow();
  });

  it('las restricciones CHECK rechazan capacidades y horarios inválidos', () => {
    db.exec(`
      INSERT INTO users (id, name, email, password_hash, role) VALUES ('u1', 'Org', 'o@x.mx', 'h', 'organizer');
      INSERT INTO clients (id, organizer_id, first_name, last_name, email, phone) VALUES ('c1', 'u1', 'Ana', 'Ruiz', 'a@x.mx', '33');
      INSERT INTO events (id, organizer_id, client_id, title, event_type, event_date, venue_name) VALUES ('e1', 'u1', 'c1', 'Boda', 'wedding', '2027-01-10', 'Salón');
    `);
    expect(() =>
      db.exec("INSERT INTO event_tables (id, event_id, table_number, capacity) VALUES ('t0', 'e1', 1, 0)")
    ).toThrow(/CHECK/);
    expect(() =>
      db.exec(
        "INSERT INTO agenda_items (id, event_id, title, start_time, end_time, responsible_person) VALUES ('a1', 'e1', 'Vals', '21:00', '20:00', 'DJ')"
      )
    ).toThrow(/CHECK/);
  });
});
