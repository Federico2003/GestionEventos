import { describe, expect, it } from 'vitest';
import { GuestEntity } from '../src/domain/entities/GuestEntity';
import { generateCateringReport } from '../src/domain/services/CateringReportService';

describe('CP-CAT-03: CateringReportService — Menús, Alergias y Reporte para Banquetero', () => {
  it('Escenario 3.1: marca la alergia crítica y la conserva ligada a la mesa del invitado', () => {
    const guest = new GuestEntity({
      id: 'g-1',
      firstName: 'Ana',
      lastName: 'Ruiz',
      rsvpStatus: 'confirmed',
      plusOnes: 0,
      tableNumber: 7
    });

    guest.registerDietaryProfile(
      'vegetarian',
      'Cacahuates / Frutos secos',
      true,
      'Riesgo de choque anafiláctico'
    );

    expect(guest.mealPreference).toBe('vegetarian');
    expect(guest.hasCriticalAllergies).toBe(true);
    expect(guest.dietaryRestrictions).toBe('Riesgo de choque anafiláctico');
    expect(guest.tableNumber).toBe(7);
  });

  it('Escenario 3.2: consolida platillos por menú, por mesa y alertas críticas (solo confirmados)', () => {
    const guests = [
      new GuestEntity({
        id: 'g-1',
        rsvpStatus: 'confirmed',
        tableNumber: 1,
        mealPreference: 'standard'
      }),
      new GuestEntity({
        id: 'g-2',
        rsvpStatus: 'confirmed',
        tableNumber: 1,
        mealPreference: 'vegan',
        allergies: 'Gluten',
        hasCriticalAllergies: true
      }),
      new GuestEntity({
        id: 'g-3',
        rsvpStatus: 'confirmed',
        tableNumber: 2,
        mealPreference: 'child'
      }),
      new GuestEntity({
        id: 'g-4',
        rsvpStatus: 'declined',
        tableNumber: 2,
        mealPreference: 'kosher'
      }),
      new GuestEntity({
        id: 'g-5',
        rsvpStatus: 'pending',
        tableNumber: 2,
        mealPreference: 'vegetarian'
      })
    ];

    const report = generateCateringReport(guests);

    expect(report.totalsByMenu).toEqual({ standard: 1, vegan: 1, child: 1 });
    expect(report.platesByTable).toEqual({ 1: 2, 2: 1 });
    expect(report.criticalAlerts).toEqual([{ guestId: 'g-2', tableNumber: 1, allergen: 'Gluten' }]);
  });
});
