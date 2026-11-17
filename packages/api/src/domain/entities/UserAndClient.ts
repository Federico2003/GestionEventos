import { DomainError, ValidationError } from '../errors';
import type { EventStatus, UserRole } from '../types';

export interface UserProps {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone?: string;
  isActive?: boolean;
}

export class UserEntity {
  public readonly id: string;
  public name: string;
  public email: string;
  public passwordHash: string;
  public role: UserRole;
  public phone: string;
  public isActive: boolean;

  constructor(props: UserProps) {
    if (!props.email || !props.email.includes('@')) {
      throw new ValidationError('El correo electrónico del usuario es inválido');
    }
    this.id = props.id;
    this.name = props.name.trim();
    this.email = props.email.toLowerCase().trim();
    this.passwordHash = props.passwordHash;
    this.role = props.role;
    this.phone = props.phone ?? '';
    this.isActive = props.isActive ?? true;
  }

  public deactivate(): void {
    this.isActive = false;
  }

  public static isStrongPassword(password: string): boolean {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password)
    );
  }
}

export interface ClientProps {
  id: string;
  organizerId: string;
  userId?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes?: string;
}

export class ClientEntity {
  public readonly id: string;
  public readonly organizerId: string;
  public userId: string | null;
  public firstName: string;
  public lastName: string;
  public email: string;
  public phone: string;
  public notes: string;

  constructor(props: ClientProps) {
    if (!props.firstName.trim() || !props.phone.trim()) {
      throw new ValidationError('El nombre y teléfono del cliente son obligatorios');
    }
    this.id = props.id;
    this.organizerId = props.organizerId;
    this.userId = props.userId ?? null;
    this.firstName = props.firstName.trim();
    this.lastName = props.lastName.trim();
    this.email = props.email.toLowerCase().trim();
    this.phone = props.phone.trim();
    this.notes = props.notes ?? '';
  }

  public updateProfile(changes: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    notes?: string;
  }): void {
    const firstName = changes.firstName !== undefined ? changes.firstName.trim() : this.firstName;
    const phone = changes.phone !== undefined ? changes.phone.trim() : this.phone;
    if (!firstName || !phone) {
      throw new ValidationError('El nombre y teléfono del cliente son obligatorios');
    }
    this.firstName = firstName;
    this.phone = phone;
    if (changes.lastName !== undefined) this.lastName = changes.lastName.trim();
    if (changes.email !== undefined) this.email = changes.email.toLowerCase().trim();
    if (changes.notes !== undefined) this.notes = changes.notes;
  }

  public linkUserAccount(userId: string): void {
    this.userId = userId;
  }

  public ensureCanBeDeleted(events: Array<{ status: EventStatus }>): void {
    const hasActiveEvents = events.some(
      (e) => e.status === 'in_progress' || e.status === 'planning' || e.status === 'confirmed'
    );
    if (hasActiveEvents) {
      throw new DomainError(
        'No se puede eliminar un cliente con eventos activos o en planificación',
        'CLIENT_HAS_ACTIVE_EVENTS',
        422
      );
    }
  }
}
