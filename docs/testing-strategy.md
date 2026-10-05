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
5. **Esquemas de Validación Zod:** Rechazo estricto de cargas útiles (*payloads*) maliciosas o malformadas.

### 1.2 Lo que NO se prueba mediante Unit Tests
- Redes reales o llamadas remotas hacia la nube de Cloudflare (se utilizan bindings simulados en memoria).
- Representación visual CSS, colores o diseño adaptativo del navegador.
- Criptografía interna del runtime de Node/V8 (se asume que `crypto.subtle` funciona según especificación).

---

## 2. Casos de Prueba Críticos y Ejemplos de Implementación con Vitest

A continuación se presentan los archivos de prueba que verifican los métodos clave de la solución:

### Caso 1: Pruebas Unitarias del Motor Financiero (`BudgetCalculator.spec.ts`)

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

  it('debe marcar sobrecosto (isOverrun=true) y alerta roja cuando los gastos superan el 100%', () => {
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
      { id: 'exp-1', amount: 1200, paymentStatus: 'paid' }
    ];

    const result = calculateBudgetStatus(initialBudget, expenses as Expense[]);

    expect(result.spentPercentage).toBe(100.0);
    expect(result.remainingBalance).toBe(-1200);
    expect(result.statusAlert).toBe('red');
    expect(result.isOverrun).toBe(true);
  });
});
```

---

### Caso 2: Pruebas del Ciclo de Vida del Evento (`EventLifecycle.spec.ts`)

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

### Caso 3: Pruebas de RSVP y Asignación de Mesas (`GuestService.spec.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { GuestEntity } from '../src/domain/entities/GuestEntity';

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
});
```

---

### Caso 4: Detección de Conflictos en Cronograma (`AgendaService.spec.ts`)

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
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
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
