# Estrategia de Pruebas Unitarias y Calidad de Software — Planora

**Framework de Pruebas:** Vitest v1.5+  
**Entorno de Ejecución:** Node.js / Miniflare (Edge Worker Isolation)  
**Herramienta de Aserciones y Mocks:** Vitest Mocking Engine + Zod Validation  
**Meta de Cobertura:** $\ge 85\%$ en Capa de Dominio y Métodos de Negocio; $\ge 75\%$ global  

---

## 1. Filosofía de Pruebas

Para un proyecto universitario individual, la pirámide de pruebas debe centrarse en lo que aporta mayor valor y estabilidad: **Pruebas Unitarias Herméticas sobre la Lógica de Negocio**.

```text
         / \
        / E2E \         (0% - Fuera de alcance del MVP inicial)
       /-------\
      / Integr. \       (20% - Rutas Hono + Migraciones D1 con Miniflare)
     /-----------\
    /  Unitarias  \     (80% - Lógica de Dominio, Presupuesto, RSVP, Agenda)
   /---------------\
```

### 1.1 Lo que SÍ se prueba exhaustivamente
1. **Lógica de Presupuesto y Gastos:** Conciliación, cálculo de varianza, porcentajes de ejecución, detección de sobrecostos (*overrun*).
2. **Ciclo de Vida y Transiciones de Estado:** Validación de reglas de cambio de estado en eventos (`draft` -> `confirmed` -> `completed` / `cancelled`).
3. **Gestión de Invitados y Aforo:** Confirmación de asistencia (RSVP), límites de acompañantes y restricción de capacidad máxima de mesas.
4. **Detección de Conflictos en la Agenda:** Algoritmos de solapamiento horario en el itinerario del evento.
5. **Perfil Gastronómico y Reporte de Catering:** Registro de menús, marcado de alergias críticas y consolidado por mesa.
6. **Autenticación y RBAC:** Emisión de JWT, bloqueo por rol y revocación de tokens en KV (con bindings simulados en memoria).
7. **Esquemas de Validación Zod:** Rechazo estricto de cargas útiles (*payloads*) maliciosas o malformadas.

### 1.2 Lo que NO se prueba mediante Unit Tests
- La regla de *rate limiting* del WAF de Cloudflare (vive en la red de Cloudflare, no en el código). Se verifica una vez desplegada enviando 11 peticiones seguidas a `/api/v1/auth/login` y comprobando que la última responde `429`.
- Redes reales o llamadas remotas hacia la nube de Cloudflare (se utilizan bindings simulados en memoria).
- Representación visual CSS, colores o diseño adaptativo del navegador.
- Criptografía interna del runtime de Node/V8 (se asume que `crypto.subtle` funciona según especificación).

---

## 2. Casos de Prueba Críticos y Ejemplos de Implementación con Vitest

A continuación se presentan los archivos de prueba que verifican los métodos clave de la solución. Cada suite se vincula con su caso de prueba formal del documento de especificación:

| Suite Vitest | Caso de Prueba |
|---|---|
| `BudgetCalculator.spec.ts` | `CP-FIN-01` Conciliación financiera y semáforo |
| `GuestService.spec.ts` | `CP-MES-02` Aforo y asignación de mesas |
| `CateringReport.spec.ts` | `CP-CAT-03` Menús, alergias y reporte de catering |
| `AgendaService.spec.ts` | `CP-AGE-04` Detección de conflictos horarios |
| `AuthRbac.spec.ts` | `CP-SEC-05` Autenticación, RBAC y revocación |
| `EventLifecycle.spec.ts` | Reglas complementarias del ciclo de vida del evento |

### Caso 1 (`CP-FIN-01`): Pruebas Unitarias del Motor Financiero (`BudgetCalculator.spec.ts`)

Verifica el comportamiento de cálculo presupuestario en los 4 escenarios obligatorios:
1. Presupuesto sin gastos registrados.
2. Presupuesto con gastos normales bajo control.
3. Presupuesto excedido (sobrecosto / alerta roja).
4. Valores límite e inválidos (presupuesto inicial en cero o montos anómalos).

```typescript
import { describe, it, expect } from 'vitest';
import { calculateBudgetStatus } from '../src/domain/services/BudgetCalculator';
import { Expense } from '../src/domain/entities/Expense';

describe('BudgetCalculator — calculateBudgetStatus()', () => {
  const sampleEventId = 'evt-test-101';

  it('debe calcular correctamente un presupuesto sin gastos registrados (Estado Verde)', () => {
    const initialBudget = 100000;
    const expenses: Expense[] = [];

    const result = calculateBudgetStatus(initialBudget, expenses);

    expect(result.initialBudget).toBe(100000);
    expect(result.totalSpent).toBe(0);
    expect(result.remainingBalance).toBe(100000);
    expect(result.spentPercentage).toBe(0);
    expect(result.statusAlert).toBe('green');
    expect(result.isOverrun).toBe(false);
  });

  it('debe calcular balance y porcentaje con gastos parciales aprobados', () => {
    const initialBudget = 50000;
    const expenses: Partial<Expense>[] = [
      { id: 'exp-1', amount: 15000, paymentStatus: 'paid' },
      { id: 'exp-2', amount: 10000, paymentStatus: 'pending' }
    ];

    const result = calculateBudgetStatus(initialBudget, expenses as Expense[]);

    expect(result.totalSpent).toBe(25000);
    expect(result.remainingBalance).toBe(25000);
    expect(result.spentPercentage).toBe(50.0);
    expect(result.statusAlert).toBe('green');
    expect(result.isOverrun).toBe(false);
  });

  it('debe emitir alerta amarilla cuando los gastos alcanzan o superan el 90% del presupuesto', () => {
    const initialBudget = 10000;
    const expenses: Partial<Expense>[] = [
      { id: 'exp-1', amount: 9200, paymentStatus: 'paid' }
    ];

    const result = calculateBudgetStatus(initialBudget, expenses as Expense[]);

    expect(result.spentPercentage).toBe(92.0);
    expect(result.statusAlert).toBe('yellow');
    expect(result.isOverrun).toBe(false);
  });

  it('debe marcar sobrecosto (isOverrun=true) y alerta roja cuando los gastos alcanzan o superan el 100%', () => {
    const initialBudget = 20000;
    const expenses: Partial<Expense>[] = [
      { id: 'exp-1', amount: 18000, paymentStatus: 'paid' },
      { id: 'exp-2', amount: 5000, paymentStatus: 'pending' }
    ];

    const result = calculateBudgetStatus(initialBudget, expenses as Expense[]);

    expect(result.totalSpent).toBe(23000);
    expect(result.remainingBalance).toBe(-3000);
    expect(result.spentPercentage).toBe(115.0);
    expect(result.statusAlert).toBe('red');
    expect(result.isOverrun).toBe(true);
  });

  it('debe manejar adecuadamente presupuestos iniciales en cero sin generar división por cero', () => {
    const initialBudget = 0;
    const expenses: Partial<Expense>[] = [
      { id: 'exp-1', amount: 1500, paymentStatus: 'paid' }
    ];

    const result = calculateBudgetStatus(initialBudget, expenses as Expense[]);

    // Regla defensiva: con presupuesto 0 y gasto > 0 se reporta 100% (nunca NaN ni Infinity)
    expect(result.spentPercentage).toBe(100.0);
    expect(Number.isFinite(result.spentPercentage)).toBe(true);
    expect(result.remainingBalance).toBe(-1500);
    expect(result.statusAlert).toBe('red');
    expect(result.isOverrun).toBe(true);
  });
});
```

---

### Caso 2 (complementario): Pruebas del Ciclo de Vida del Evento (`EventLifecycle.spec.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { EventEntity } from '../src/domain/entities/EventEntity';

describe('EventEntity — Transiciones de Estado y Reglas de Negocio', () => {
  it('no debe permitir confirmar un evento con fecha en el pasado', () => {
    const pastDate = new Date('2020-01-01');
    const event = new EventEntity({
      id: 'evt-1',
      title: 'Boda Antigua',
      eventDate: pastDate,
      initialBudget: 50000,
      clientId: 'cli-1',
      status: 'draft'
    });

    expect(() => event.confirmEvent()).toThrowError('No es posible confirmar un evento con fecha en el pasado');
    expect(event.status).toBe('draft');
  });

  it('debe confirmar exitosamente un evento válido con cliente asignado y fecha futura', () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3);

    const event = new EventEntity({
      id: 'evt-2',
      title: 'Boda Andrea & Roberto',
      eventDate: futureDate,
      initialBudget: 150000,
      clientId: 'cli-99',
      status: 'draft'
    });

    const success = event.confirmEvent();
    expect(success).toBe(true);
    expect(event.status).toBe('confirmed');
  });

  it('debe calcular el progreso porcentual con base en tareas terminadas', () => {
    const event = new EventEntity({
      id: 'evt-3',
      title: 'Graduación IT',
      eventDate: new Date(),
      initialBudget: 20000,
      clientId: 'cli-1'
    });

    const tasks = [
      { id: 't-1', status: 'completed' },
      { id: 't-2', status: 'completed' },
      { id: 't-3', status: 'todo' },
      { id: 't-4', status: 'in_progress' }
    ];

    const progress = event.calculateProgress(tasks);
    expect(progress).toBe(50.0); // 2 de 4 tareas completadas = 50%
  });
});
```

---

### Caso 3 (`CP-MES-02`): Pruebas de RSVP y Asignación de Mesas (`GuestService.spec.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { GuestEntity } from '../src/domain/entities/GuestEntity';
import { EventTable } from '../src/domain/entities/EventTable';
import { TableCapacityExceededError } from '../src/domain/errors';

describe('GuestEntity — RSVP y Asignación de Mesas', () => {
  it('debe actualizar el estado de confirmación de asistencia con acompañantes válidos', () => {
    const guest = new GuestEntity({
      id: 'g-1',
      firstName: 'Carlos',
      lastName: 'Mendoza',
      rsvpStatus: 'pending',
      plusOnes: 1
    });

    guest.registerRsvp('confirmed', 1);
    expect(guest.rsvpStatus).toBe('confirmed');
    expect(guest.plusOnes).toBe(1);
  });

  it('debe rechazar la asignación si el número de personas sobrepasa la capacidad de la mesa', () => {
    const guest = new GuestEntity({
      id: 'g-2',
      firstName: 'Elena',
      lastName: 'Gómez',
      rsvpStatus: 'confirmed',
      plusOnes: 2 // Ocupa 3 asientos (titular + 2 acompañantes)
    });

    const currentSeatedAtTable = 8;
    const maxCapacity = 10;

    // 8 + 3 = 11 > 10 (excede capacidad)
    const canAssign = guest.canFitInTable(currentSeatedAtTable, maxCapacity);
    expect(canAssign).toBe(false);
  });

  it('Escenario 2.1: asigna la mesa cuando titular + acompañante caben (6 + 2 = 8 <= 10)', () => {
    const guest = new GuestEntity({ id: 'g-3', firstName: 'Lucía', lastName: 'Ríos', rsvpStatus: 'confirmed', plusOnes: 1 });
    const mesa4 = new EventTable({ id: 't-4', eventId: 'evt-1', tableNumber: 4, capacity: 10 });

    expect(guest.assignTable(mesa4, 6)).toBe(true);
    expect(guest.tableNumber).toBe(4);
  });

  it('Escenario 2.2: lanza TableCapacityExceededError por sobrecupo (9 + 3 = 12 > 10)', () => {
    const guest = new GuestEntity({ id: 'g-4', firstName: 'Mario', lastName: 'Luna', rsvpStatus: 'confirmed', plusOnes: 2 });
    const mesa2 = new EventTable({ id: 't-2', eventId: 'evt-1', tableNumber: 2, capacity: 10 });

    expect(() => guest.assignTable(mesa2, 9)).toThrow(TableCapacityExceededError);
    expect(guest.tableNumber).toBeNull();
  });
});
```

---

### Caso 4 (`CP-AGE-04`): Detección de Conflictos en Cronograma (`AgendaService.spec.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { detectTimelineConflicts } from '../src/domain/services/AgendaService';

describe('AgendaService — Detección de Conflictos Horarios', () => {
  it('debe detectar solapamiento horario en el mismo escenario físico', () => {
    const timeline = [
      { id: 'a1', title: 'Vals Principal', startTime: '21:00', endTime: '21:30', locationDetail: 'Pista Central' },
      { id: 'a2', title: 'Presentación Mariachi', startTime: '21:15', endTime: '22:00', locationDetail: 'Pista Central' }
    ];

    const conflicts = detectTimelineConflicts(timeline);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].itemAId).toBe('a1');
    expect(conflicts[0].itemBId).toBe('a2');
  });

  it('no debe reportar conflicto si los horarios no se empalman', () => {
    const timeline = [
      { id: 'a1', title: 'Recepción', startTime: '19:00', endTime: '20:00', locationDetail: 'Jardín' },
      { id: 'a2', title: 'Cena Formal', startTime: '20:00', endTime: '21:30', locationDetail: 'Salón Principal' }
    ];

    const conflicts = detectTimelineConflicts(timeline);
    expect(conflicts.length).toBe(0);
  });
});
```

---

### Caso 5 (`CP-CAT-03`): Perfil Gastronómico y Reporte de Catering (`CateringReport.spec.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { GuestEntity } from '../src/domain/entities/GuestEntity';
import { generateCateringReport } from '../src/domain/services/CateringReportService';

describe('CateringReportService — Menús, Alergias y Reporte para Banquetero', () => {
  it('Escenario 3.1: marca la alergia crítica y la conserva ligada a la mesa del invitado', () => {
    const guest = new GuestEntity({ id: 'g-1', firstName: 'Ana', lastName: 'Ruiz', rsvpStatus: 'confirmed', plusOnes: 0, tableNumber: 7 });

    guest.registerDietaryProfile('vegetarian', 'Cacahuates / Frutos secos', true, 'Riesgo de choque anafiláctico');

    expect(guest.mealPreference).toBe('vegetarian');
    expect(guest.hasCriticalAllergies).toBe(true);
    expect(guest.tableNumber).toBe(7);
  });

  it('Escenario 3.2: consolida platillos por menú, por mesa y alertas críticas (solo confirmados)', () => {
    const guests = [
      new GuestEntity({ id: 'g-1', rsvpStatus: 'confirmed', tableNumber: 1, mealPreference: 'standard' }),
      new GuestEntity({ id: 'g-2', rsvpStatus: 'confirmed', tableNumber: 1, mealPreference: 'vegan', allergies: 'Gluten', hasCriticalAllergies: true }),
      new GuestEntity({ id: 'g-3', rsvpStatus: 'confirmed', tableNumber: 2, mealPreference: 'child' }),
      new GuestEntity({ id: 'g-4', rsvpStatus: 'declined', tableNumber: 2, mealPreference: 'kosher' })
    ];

    const report = generateCateringReport(guests);

    expect(report.totalsByMenu).toEqual({ standard: 1, vegan: 1, child: 1 });
    expect(report.platesByTable).toEqual({ 1: 2, 2: 1 });
    expect(report.criticalAlerts).toEqual([{ guestId: 'g-2', tableNumber: 1, allergen: 'Gluten' }]);
  });
});
```

---

### Caso 6 (`CP-SEC-05`): Autenticación, RBAC y Revocación de Tokens (`AuthRbac.spec.ts`)

Se prueba la aplicación Hono con `app.request()` y bindings simulados en memoria (sin red ni Cloudflare real):

```typescript
import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app';
import { InMemoryKV } from './fakes/InMemoryKV';
import { signTestToken } from './fakes/tokens';

describe('Auth & RBAC — JWT, permisos por rol y logout con KV', () => {
  const kv = new InMemoryKV();
  const app = createApp({ kv, jwtSecret: 'test-secret' });

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
    const token = await signTestToken({ userId: 'u-org', role: 'organizer', jti: 'jti-123' }, 'test-secret');
    const auth = { Authorization: `Bearer ${token}` };

    const logout = await app.request('/api/v1/auth/logout', { method: 'POST', headers: auth });
    expect(logout.status).toBe(204);
    expect(await kv.get('blacklist:jti-123')).not.toBeNull();

    const res = await app.request('/api/v1/events', { headers: auth });
    expect(res.status).toBe(401);
  });
});
```

---

## 3. Configuración de Cobertura en Vitest (`vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      // Vitest >= 1.x: los umbrales van dentro de `thresholds`.
      // Si no se cumplen, `npm run test:coverage` falla y el pipeline de CI se detiene.
      thresholds: {
        // Meta global
        lines: 75,
        functions: 75,
        branches: 75,
        statements: 75,
        // Meta de la capa de dominio (≥ 85%)
        'packages/api/src/domain/**': {
          lines: 85,
          functions: 85,
          branches: 85,
          statements: 85
        }
      },
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.spec.ts',
        '**/*.test.ts'
      ]
    }
  }
});
```
