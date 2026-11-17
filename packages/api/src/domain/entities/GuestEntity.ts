import { TableCapacityExceededError, ValidationError } from '../errors';
import type { MealPreference, RsvpStatus } from '../types';
import { EventTable } from './EventTable';

export interface GuestProps {
  id: string;
  eventId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tableNumber?: number | null;
  rsvpStatus?: RsvpStatus;
  plusOnes?: number;
  mealPreference?: MealPreference;
  allergies?: string;
  hasCriticalAllergies?: boolean;
  dietaryRestrictions?: string;
}

export class GuestEntity {
  public readonly id: string;
  public eventId: string;
  public firstName: string;
  public lastName: string;
  public email: string;
  public phone: string;
  public tableNumber: number | null;
  public rsvpStatus: RsvpStatus;
  public plusOnes: number;
  public mealPreference: MealPreference;
  public allergies: string;
  public hasCriticalAllergies: boolean;
  public dietaryRestrictions: string;

  constructor(props: GuestProps) {
    const plusOnes = props.plusOnes ?? 0;
    if (!Number.isInteger(plusOnes) || plusOnes < 0) {
      throw new ValidationError('El número de acompañantes debe ser un entero mayor o igual a cero');
    }

    this.id = props.id;
    this.eventId = props.eventId ?? '';
    this.firstName = props.firstName ?? 'Invitado';
    this.lastName = props.lastName ?? '';
    this.email = props.email ?? '';
    this.phone = props.phone ?? '';
    this.tableNumber = props.tableNumber ?? null;
    this.rsvpStatus = props.rsvpStatus ?? 'pending';
    this.plusOnes = plusOnes;
    this.mealPreference = props.mealPreference ?? 'standard';
    this.allergies = props.allergies ?? '';
    this.hasCriticalAllergies = props.hasCriticalAllergies ?? false;
    this.dietaryRestrictions = props.dietaryRestrictions ?? '';
  }

  public get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  public get totalSeats(): number {
    return this.rsvpStatus === 'declined' ? 0 : 1 + this.plusOnes;
  }

  public registerRsvp(status: RsvpStatus, plusOnes = 0, maxPlusOnes = 5): boolean {
    if (!Number.isInteger(plusOnes) || plusOnes < 0 || plusOnes > maxPlusOnes) {
      throw new ValidationError(
        `El número de acompañantes debe estar entre 0 y ${maxPlusOnes}`
      );
    }

    this.rsvpStatus = status;
    if (status === 'declined') {
      this.plusOnes = 0;
      this.tableNumber = null;
    } else {
      this.plusOnes = plusOnes;
    }
    return true;
  }

  public canFitInTable(currentSeated: number, maxCapacity: number): boolean {
    const seatsNeeded = 1 + this.plusOnes;
    return currentSeated + seatsNeeded <= maxCapacity;
  }

  public assignTable(table: EventTable, currentSeated: number): boolean {
    if (this.rsvpStatus === 'declined') {
      throw new ValidationError('No es posible asignar mesa a un invitado con RSVP declinado');
    }
    const seatsNeeded = 1 + this.plusOnes;
    if (!this.canFitInTable(currentSeated, table.capacity)) {
      const available = table.availableSeats(currentSeated);
      throw new TableCapacityExceededError(table.tableNumber, seatsNeeded, available);
    }

    this.tableNumber = table.tableNumber;
    return true;
  }

  public registerDietaryProfile(
    mealPref: MealPreference,
    allergies = '',
    isCritical = false,
    notes = ''
  ): void {
    this.mealPreference = mealPref;
    this.allergies = allergies.trim();
    this.hasCriticalAllergies = Boolean(isCritical);
    this.dietaryRestrictions = notes.trim();
  }
}
