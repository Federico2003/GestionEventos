import { describe, expect, it } from 'vitest';
import { EventTable } from '../src/domain/entities/EventTable';
import { GuestEntity } from '../src/domain/entities/GuestEntity';
import { TableCapacityExceededError, ValidationError } from '../src/domain/errors';
import {
  assignGuestToTableWithOccupancy,
  calculateRsvpMetrics
} from '../src/domain/services/GuestService';

describe('CP-MES-02: GuestEntity & GuestService — RSVP y Asignación de Mesas', () => {
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
    expect(guest.totalSeats).toBe(2);

    // Si declina, libera mesa y acompañantes
    guest.tableNumber = 4;
    guest.registerRsvp('declined', 2);
    expect(guest.plusOnes).toBe(0);
    expect(guest.tableNumber).toBeNull();
    expect(guest.totalSeats).toBe(0);

    expect(() => guest.registerRsvp('confirmed', 9)).toThrow(ValidationError);
  });

  it('debe rechazar la asignación si el número de personas sobrepasa la capacidad de la mesa', () => {
    const guest = new GuestEntity({
      id: 'g-2',
      firstName: 'Elena',
      lastName: 'Gómez',
      rsvpStatus: 'confirmed',
      plusOnes: 2
    });

    expect(guest.canFitInTable(8, 10)).toBe(false);
  });

  it('Escenario 2.1: asigna la mesa cuando titular + acompañante caben (6 + 2 = 8 <= 10)', () => {
    const guest = new GuestEntity({
      id: 'g-3',
      firstName: 'Lucía',
      lastName: 'Ríos',
      rsvpStatus: 'confirmed',
      plusOnes: 1
    });
    const mesa4 = new EventTable({ id: 't-4', eventId: 'evt-1', tableNumber: 4, capacity: 10 });

    expect(guest.assignTable(mesa4, 6)).toBe(true);
    expect(guest.tableNumber).toBe(4);
    expect(mesa4.availableSeats(8)).toBe(2);
  });

  it('Escenario 2.2: lanza TableCapacityExceededError por sobrecupo (9 + 3 = 12 > 10)', () => {
    const guest = new GuestEntity({
      id: 'g-4',
      firstName: 'Mario',
      lastName: 'Luna',
      rsvpStatus: 'confirmed',
      plusOnes: 2
    });
    const mesa2 = new EventTable({ id: 't-2', eventId: 'evt-1', tableNumber: 2, capacity: 10 });

    expect(() => guest.assignTable(mesa2, 9)).toThrow(TableCapacityExceededError);
    expect(guest.tableNumber).toBeNull();
  });

  it('debe calcular métricas RSVP y ocupación dinámica de mesas con múltiples invitados', () => {
    const mesa1 = new EventTable({ id: 't-1', eventId: 'evt-1', tableNumber: 1, capacity: 6 });
    const g1 = new GuestEntity({
      id: 'g-10',
      firstName: 'Ana',
      rsvpStatus: 'confirmed',
      plusOnes: 3,
      tableNumber: 1
    });
    const g2 = new GuestEntity({
      id: 'g-11',
      firstName: 'Luis',
      rsvpStatus: 'confirmed',
      plusOnes: 1
    });
    const g3 = new GuestEntity({
      id: 'g-12',
      firstName: 'Pedro',
      rsvpStatus: 'declined',
      plusOnes: 0
    });

    expect(assignGuestToTableWithOccupancy(g2, mesa1, [g1, g2, g3])).toBe(true);
    expect(g2.tableNumber).toBe(1);
    expect(() => g3.assignTable(mesa1, 0)).toThrow(ValidationError);

    const metrics = calculateRsvpMetrics([g1, g2, g3]);
    expect(metrics.totalInvitedGuests).toBe(3);
    expect(metrics.confirmedGuests).toBe(2);
    expect(metrics.declinedGuests).toBe(1);
    expect(metrics.totalConfirmedSeats).toBe(6);
    expect(metrics.confirmationRate).toBe(66.7);

    expect(() => new EventTable({ id: 'bad', eventId: 'evt-1', tableNumber: 0, capacity: 10 })).toThrow(
      ValidationError
    );
  });
});
