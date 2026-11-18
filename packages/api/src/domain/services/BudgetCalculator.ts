import { ValidationError } from '../errors';
import type { Expense } from '../entities/Expense';
import type { BudgetAlertLevel, BudgetSummaryVO } from '../types';

export function calculateBudgetStatus(
  initialBudget: number,
  expenses: Array<Pick<Expense, 'amount'> & Partial<Pick<Expense, 'paymentStatus'>>>
): BudgetSummaryVO {
  if (!Number.isFinite(initialBudget) || initialBudget < 0) {
    throw new ValidationError('El presupuesto inicial debe ser un número mayor o igual a cero');
  }

  let totalSpent = 0;
  let paidAmount = 0;
  let pendingAmount = 0;

  for (const exp of expenses) {
    if (!Number.isFinite(exp.amount) || exp.amount < 0) {
      throw new ValidationError('Los gastos registrados no pueden contener montos negativos o inválidos');
    }
    totalSpent += exp.amount;
    if (exp.paymentStatus === 'paid') {
      paidAmount += exp.amount;
    } else {
      pendingAmount += exp.amount;
    }
  }

  const remainingBalance = Number((initialBudget - totalSpent).toFixed(2));

  const spentPercentage =
    initialBudget === 0
      ? totalSpent > 0
        ? 100.0
        : 0.0
      : Number(((totalSpent / initialBudget) * 100).toFixed(2));

  const isOverrun = (initialBudget === 0 && totalSpent > 0) || spentPercentage >= 100;

  let statusAlert: BudgetAlertLevel = 'green';
  if (isOverrun) {
    statusAlert = 'red';
  } else if (spentPercentage >= 90) {
    statusAlert = 'yellow';
  }

  return {
    initialBudget,
    totalSpent: Number(totalSpent.toFixed(2)),
    paidAmount: Number(paidAmount.toFixed(2)),
    pendingAmount: Number(pendingAmount.toFixed(2)),
    remainingBalance,
    spentPercentage,
    statusAlert,
    isOverrun
  };
}

export function checkBudgetOverrunAlert(
  initialBudget: number,
  expenses: Array<Pick<Expense, 'amount'> & Partial<Pick<Expense, 'paymentStatus'>>>
): BudgetAlertLevel {
  return calculateBudgetStatus(initialBudget, expenses).statusAlert;
}
