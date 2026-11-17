import { defineConfig } from 'drizzle-kit';

// Genera las migraciones SQL de Cloudflare D1 a partir del esquema de Drizzle.
// Uso: npm run db:generate -w @planora/api
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/infrastructure/db/schema.ts',
  out: './migrations'
});
