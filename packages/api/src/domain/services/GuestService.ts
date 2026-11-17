import { EventTable } from '../entities/EventTable';
import { GuestEntity } from '../entities/GuestEntity';
import type { RsvpMetricsVO } from '../types';

export function calculateRsvpMetrics(guests: GuestEntity[]): RsvpMetricsVO {
  let confirmedGuests = 0;
  let pendingGuests = 0;
  let declinedGuests = 0;
  let totalConfirmedSeats = 0;

  for (const guest of guests) {
    if (guest.rsvpStatus === 'confirmed') {
      confirmedGuests += 1;
      totalConfirmedSeats += 1 + guest.plusOnes;
    } else if (guest.rsvpStatus === 'declined') {
      declinedGuests += 1;
    } else {
      pendingGuests += 1;
    }
  }

  const totalInvitedGuests = guests.length;
  const confirmationRate =
    totalInvitedGuests === 0
      ? 0
      : Number(((confirmedGuests / totalInvitedGuests) * 100).toFixed(1));

  return {
    totalInvitedGuests,
    confirmedGuests,
    pendingGuests,
    declinedGuests,
    totalConfirmedSeats,
    confirmationRate
  };
}

export function calculateSeatedAtTable(
  guests: GuestEntity[],
  tableNumber: number,
  excludeGuestId?: string
): number {
  let seated = 0;
  for (const guest of guests) {
    if (guest.id === excludeGuestId) {
      continue;
    }
    if (guest.tableNumber === tableNumber && guest.rsvpStatus !== 'declined') {
      seated += 1 + guest.plusOnes;
    }
  }
  return seated;
}

export function assignGuestToTableWithOccupancy(
  guest: GuestEntity,
  table: EventTable,
  allEventGuests: GuestEntity[]
): boolean {
  const currentSeated = calculateSeatedAtTable(allEventGuests, table.tableNumber, guest.id);
  return guest.assignTable(table, currentSeated);
}
