/**
 * Genera `seed/seed.sql` con los datos de ejemplo de Planora a partir del mismo
 * seed que usa la API en memoria (PlanoraDataStore), para que D1 y la API
 * compartan exactamente los mismos registros.
 *
 * Uso: npm run db:seed:generate -w @planora/api
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getTableColumns, getTableName, type Table } from 'drizzle-orm';
import { PlanoraDataStore } from '../src/infrastructure/store';
import { schema } from '../src/infrastructure/db/schema';
import { hashPassword } from '../src/security/jwt';

function sqlValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function insertRows(table: Table, rows: Array<Record<string, unknown>>): string[] {
  const columns = Object.entries(getTableColumns(table)).filter(
    ([key]) => key !== 'createdAt' && key !== 'updatedAt'
  );
  const names = columns.map(([, col]) => `"${col.name}"`).join(', ');
  return rows.map((row) => {
    const values = columns.map(([key]) => sqlValue(row[key])).join(', ');
    return `INSERT INTO "${getTableName(table)}" (${names}) VALUES (${values});`;
  });
}

async function main(): Promise<void> {
  const store = new PlanoraDataStore(await hashPassword('Planora2026!'));
  const vendors = [...store.vendors.values()];
  const contracts = [...store.contracts.values()];

  // Catálogo de servicios derivado de los contratos de ejemplo (un servicio por contrato).
  const services = contracts.map((ct) => ({
    id: ct.serviceId,
    vendorId: vendors.find((v) => v.businessName === ct.vendorName)?.id ?? vendors[0]?.id,
    name: ct.serviceName,
    description: `Servicio base de ${ct.vendorName}`,
    basePrice: ct.agreedPrice
  }));

  const asRows = (items: Iterable<object>) =>
    [...items].map((item) => ({ ...item }) as Record<string, unknown>);

  const statements = [
    '-- Planora — Datos de ejemplo para Cloudflare D1 (generado por scripts/generate-seed.ts)',
    '-- Aplicar con: npm run db:seed:local -w @planora/api',
    ...insertRows(schema.users, asRows(store.users.values())),
    ...insertRows(schema.clients, asRows(store.clients.values())),
    ...insertRows(schema.events, asRows(store.events.values())),
    ...insertRows(schema.eventTables, asRows(store.tables.values())),
    ...insertRows(schema.guests, asRows(store.guests.values())),
    ...insertRows(schema.vendors, asRows(vendors)),
    ...insertRows(schema.services, services),
    ...insertRows(schema.eventServices, asRows(contracts)),
    ...insertRows(schema.expenses, asRows(store.expenses.values())),
    ...insertRows(schema.tasks, asRows(store.tasks.values())),
    ...insertRows(schema.agendaItems, asRows(store.agendaItems.values()))
  ];

  const outFile = resolve(__dirname, '../seed/seed.sql');
  writeFileSync(outFile, `${statements.join('\n')}\n`, 'utf8');
  console.log(`Seed generado: ${outFile} (${statements.length - 2} registros)`);
}

void main();
