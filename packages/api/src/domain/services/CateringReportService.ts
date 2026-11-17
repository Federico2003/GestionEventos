import { GuestEntity } from '../entities/GuestEntity';
import type { CateringReportVO, CriticalAllergyAlertVO, MealPreference } from '../types';

export function generateCateringReport(guests: GuestEntity[]): CateringReportVO {
  const totalsByMenu: Partial<Record<MealPreference, number>> = {};
  const platesByTable: Record<number, number> = {};
  const criticalAlerts: CriticalAllergyAlertVO[] = [];

  for (const guest of guests) {
    if (guest.rsvpStatus !== 'confirmed') {
      continue;
    }

    const portions = 1 + guest.plusOnes;
    totalsByMenu[guest.mealPreference] = (totalsByMenu[guest.mealPreference] ?? 0) + portions;

    if (guest.tableNumber !== null && guest.tableNumber !== undefined) {
      platesByTable[guest.tableNumber] = (platesByTable[guest.tableNumber] ?? 0) + portions;
    }

    if (guest.hasCriticalAllergies) {
      criticalAlerts.push({
        guestId: guest.id,
        tableNumber: guest.tableNumber,
        allergen: guest.allergies || 'Alergia crítica registrada'
      });
    }
  }

  return {
    totalsByMenu,
    platesByTable,
    criticalAlerts
  };
}
