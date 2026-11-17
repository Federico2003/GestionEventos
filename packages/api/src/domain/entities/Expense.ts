import { ValidationError } from '../errors';
import type { ExpenseCategory, PaymentStatus } from '../types';

export interface Expense {
  id: string;
  eventId: string;
  eventServiceId?: string | null;
  concept: string;
  category: ExpenseCategory;
  amount: number;
  dueDate?: string | null;
  paymentStatus: PaymentStatus;
  receiptUrl?: string | null;
  paidAt?: string | null;
}

export class ExpenseEntity implements Expense {
  public readonly id: string;
  public readonly eventId: string;
  public eventServiceId: string | null;
  public concept: string;
  public category: ExpenseCategory;
  public amount: number;
  public dueDate: string | null;
  public paymentStatus: PaymentStatus;
  public receiptUrl: string | null;
  public paidAt: string | null;

  constructor(props: Expense) {
    if (!props.concept || !props.concept.trim()) {
      throw new ValidationError('El concepto del gasto es obligatorio');
    }
    if (!Number.isFinite(props.amount) || props.amount <= 0) {
      throw new ValidationError('El monto del gasto debe ser mayor a cero');
    }

    this.id = props.id;
    this.eventId = props.eventId;
    this.eventServiceId = props.eventServiceId ?? null;
    this.concept = props.concept.trim();
    this.category = props.category;
    this.amount = props.amount;
    this.dueDate = props.dueDate ?? null;
    this.paymentStatus = props.paymentStatus;
    this.receiptUrl = props.receiptUrl ?? null;
    this.paidAt = props.paidAt ?? null;
  }

  public registerPayment(receiptR2Key: string, paidDate: Date = new Date()): void {
    this.paymentStatus = 'paid';
    this.receiptUrl = receiptR2Key;
    this.paidAt = paidDate.toISOString();
  }

  public isOverdue(now: Date = new Date()): boolean {
    if (this.paymentStatus === 'paid' || !this.dueDate) {
      return false;
    }
    return new Date(this.dueDate).getTime() < now.getTime();
  }
}
