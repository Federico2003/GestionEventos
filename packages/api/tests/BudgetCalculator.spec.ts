import { describe, expect, it } from 'vitest';
import { ExpenseEntity, type Expense } from '../src/domain/entities/Expense';
import { ValidationError } from '../src/domain/errors';
import {
  calculateBudgetStatus,
  checkBudgetOverrunAlert
} from '../src/domain/services/BudgetCalculator';

describe('CP-FIN-01: BudgetCalculator — Conciliación financiera y semáforo', () => {
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

  it('debe calcular balance y porcentaje con gastos parciales aprobados y pendientes', () => {
    const initialBudget = 50000;
    const expenses: Partial<Expense>[] = [
      { id: 'exp-1', amount: 15000, paymentStatus: 'paid' },
      { id: 'exp-2', amount: 10000, paymentStatus: 'pending' }
    ];

    const result = calculateBudgetStatus(initialBudget, expenses as Expense[]);

    expect(result.totalSpent).toBe(25000);
    expect(result.paidAmount).toBe(15000);
    expect(result.pendingAmount).toBe(10000);
    expect(result.remainingBalance).toBe(25000);
    expect(result.spentPercentage).toBe(50.0);
    expect(result.statusAlert).toBe('green');
    expect(result.isOverrun).toBe(false);
  });

  it('debe emitir alerta amarilla cuando los gastos alcanzan o superan el 90% del presupuesto', () => {
    const initialBudget = 10000;
    const expenses: Partial<Expense>[] = [{ id: 'exp-1', amount: 9200, paymentStatus: 'paid' }];

    const result = calculateBudgetStatus(initialBudget, expenses as Expense[]);

    expect(result.spentPercentage).toBe(92.0);
    expect(result.statusAlert).toBe('yellow');
    expect(result.isOverrun).toBe(false);
    expect(checkBudgetOverrunAlert(initialBudget, expenses as Expense[])).toBe('yellow');
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
    const expenses: Partial<Expense>[] = [{ id: 'exp-1', amount: 1500, paymentStatus: 'paid' }];

    const result = calculateBudgetStatus(initialBudget, expenses as Expense[]);

    expect(result.spentPercentage).toBe(100.0);
    expect(Number.isFinite(result.spentPercentage)).toBe(true);
    expect(result.remainingBalance).toBe(-1500);
    expect(result.statusAlert).toBe('red');
    expect(result.isOverrun).toBe(true);

    const zeroClean = calculateBudgetStatus(0, []);
    expect(zeroClean.spentPercentage).toBe(0);
    expect(zeroClean.statusAlert).toBe('green');
  });

  it('debe rechazar presupuestos iniciales negativos o gastos con montos negativos', () => {
    expect(() => calculateBudgetStatus(-100, [])).toThrow(ValidationError);
    expect(() =>
      calculateBudgetStatus(10000, [{ amount: -50, paymentStatus: 'pending' }])
    ).toThrow(ValidationError);
  });

  it('ExpenseEntity debe sellar pago con recibo R2 y evaluar vencimiento correctamente', () => {
    const expense = new ExpenseEntity({
      id: 'exp-10',
      eventId: 'evt-1',
      concept: 'Anticipo Flores',
      category: 'flowers',
      amount: 12000,
      dueDate: '2020-01-01',
      paymentStatus: 'pending'
    });

    expect(expense.isOverdue(new Date('2026-01-01'))).toBe(true);
    expense.registerPayment('receipts/evt-1/flores.pdf');
    expect(expense.paymentStatus).toBe('paid');
    expect(expense.receiptUrl).toBe('receipts/evt-1/flores.pdf');
    expect(expense.isOverdue(new Date('2026-01-01'))).toBe(false);

    expect(() =>
      new ExpenseEntity({
        id: 'exp-bad',
        eventId: 'evt-1',
        concept: '',
        category: 'other',
        amount: 100,
        paymentStatus: 'pending'
      })
    ).toThrow(ValidationError);

    expect(() =>
      new ExpenseEntity({
        id: 'exp-bad-2',
        eventId: 'evt-1',
        concept: 'Válido',
        category: 'other',
        amount: 0,
        paymentStatus: 'pending'
      })
    ).toThrow(ValidationError);
  });
});
