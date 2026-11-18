import { ValidationError } from '../errors';
import type { ContractStatus, VendorCategory } from '../types';
import { ExpenseEntity } from './Expense';

export interface VendorProps {
  id: string;
  organizerId: string;
  businessName: string;
  category: VendorCategory;
  contactName: string;
  email: string;
  phone: string;
  rating?: number;
}

export class VendorEntity {
  public readonly id: string;
  public readonly organizerId: string;
  public businessName: string;
  public category: VendorCategory;
  public contactName: string;
  public email: string;
  public phone: string;
  public rating: number;

  constructor(props: VendorProps) {
    const rating = props.rating ?? 5.0;
    if (rating < 1.0 || rating > 5.0) {
      throw new ValidationError('La calificación del proveedor debe estar entre 1.0 y 5.0');
    }
    this.id = props.id;
    this.organizerId = props.organizerId;
    this.businessName = props.businessName.trim();
    this.category = props.category;
    this.contactName = props.contactName.trim();
    this.email = props.email.trim();
    this.phone = props.phone.trim();
    this.rating = rating;
  }

  public updateRating(newRating: number): void {
    if (newRating < 1.0 || newRating > 5.0) {
      throw new ValidationError('La calificación debe estar en la escala de 1.0 a 5.0');
    }
    this.rating = Number(newRating.toFixed(1));
  }
}

export interface EventServiceProps {
  id: string;
  eventId: string;
  serviceId: string;
  serviceName?: string;
  vendorName?: string;
  category?: VendorCategory;
  agreedPrice: number;
  status?: ContractStatus;
  contractUrl?: string | null;
  notes?: string;
}

export class EventServiceEntity {
  public readonly id: string;
  public readonly eventId: string;
  public readonly serviceId: string;
  public serviceName: string;
  public vendorName: string;
  public category: VendorCategory;
  public agreedPrice: number;
  public status: ContractStatus;
  public contractUrl: string | null;
  public notes: string;

  constructor(props: EventServiceProps) {
    if (props.agreedPrice <= 0) {
      throw new ValidationError('El precio acordado del contrato debe ser mayor a cero');
    }
    this.id = props.id;
    this.eventId = props.eventId;
    this.serviceId = props.serviceId;
    this.serviceName = props.serviceName ?? 'Servicio Contratado';
    this.vendorName = props.vendorName ?? 'Proveedor';
    this.category = props.category ?? 'other';
    this.agreedPrice = props.agreedPrice;
    this.status = props.status ?? 'contracted';
    this.contractUrl = props.contractUrl ?? null;
    this.notes = props.notes ?? '';
  }

  public attachContractDocument(r2Key: string): void {
    if (!r2Key.trim()) {
      throw new ValidationError('La llave del documento en R2 no puede estar vacía');
    }
    this.contractUrl = r2Key.trim();
    if (this.status === 'quoted') {
      this.status = 'contracted';
    }
  }

  public cancelContract(): boolean {
    this.status = 'cancelled';
    return true;
  }

  public generateExpense(expenseId: string): ExpenseEntity {
    return new ExpenseEntity({
      id: expenseId,
      eventId: this.eventId,
      eventServiceId: this.id,
      concept: `Contrato: ${this.serviceName} (${this.vendorName})`,
      category: this.category,
      amount: this.agreedPrice,
      paymentStatus: 'pending'
    });
  }
}
