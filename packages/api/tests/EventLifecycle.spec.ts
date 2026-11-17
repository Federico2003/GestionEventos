import { describe, expect, it } from 'vitest';
import { EventEntity } from '../src/domain/entities/EventEntity';
import { ClientEntity, UserEntity } from '../src/domain/entities/UserAndClient';
import { EventServiceEntity, VendorEntity } from '../src/domain/entities/VendorAndService';
import { DomainError, ValidationError } from '../src/domain/errors';

describe('EventEntity & Entidades Relacionadas — Ciclo de Vida y Reglas de Negocio', () => {
  it('no debe permitir confirmar un evento con fecha en el pasado', () => {
    const pastDate = new Date('2020-01-01');
    const event = new EventEntity({
      id: 'evt-1',
      title: 'Boda Antigua',
      eventDate: pastDate,
      initialBudget: 50000,
      clientId: 'cli-1',
      status: 'draft'
    });

    expect(() => event.confirmEvent()).toThrowError(
      'No es posible confirmar un evento con fecha en el pasado'
    );
    expect(event.status).toBe('draft');
  });

  it('debe rechazar confirmación cuando falta cliente o el presupuesto es cero', () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 2);

    const noClientEvent = new EventEntity({
      id: 'evt-no-cli',
      title: 'Evento Sin Cliente',
      eventDate: futureDate,
      initialBudget: 50000,
      clientId: ''
    });
    expect(() => noClientEvent.confirmEvent()).toThrow(DomainError);

    const zeroBudgetEvent = new EventEntity({
      id: 'evt-zero-bud',
      title: 'Evento Sin Presupuesto',
      eventDate: futureDate,
      initialBudget: 0,
      clientId: 'cli-1'
    });
    expect(() => zeroBudgetEvent.confirmEvent()).toThrow(DomainError);
  });

  it('debe confirmar exitosamente un evento válido y permitir completarlo', () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3);

    const event = new EventEntity({
      id: 'evt-2',
      title: 'Boda Andrea & Roberto',
      eventDate: futureDate,
      initialBudget: 150000,
      clientId: 'cli-99',
      status: 'draft'
    });

    expect(() => event.completeEvent()).toThrow(DomainError);

    const success = event.confirmEvent();
    expect(success).toBe(true);
    expect(event.status).toBe('confirmed');

    expect(event.completeEvent()).toBe(true);
    expect(event.status).toBe('completed');
    expect(() => event.cancelEvent('Intento tardío')).toThrow(DomainError);
  });

  it('debe calcular el progreso porcentual con base en tareas terminadas y clonar estructura', () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 5);

    const event = new EventEntity({
      id: 'evt-3',
      title: 'Graduación IT',
      eventDate: futureDate,
      initialBudget: 20000,
      clientId: 'cli-1'
    });

    expect(event.calculateProgress([])).toBe(0);

    const tasks = [
      { id: 't-1', status: 'completed' },
      { id: 't-2', status: 'completed' },
      { id: 't-3', status: 'todo' },
      { id: 't-4', status: 'in_progress' }
    ];

    expect(event.calculateProgress(tasks)).toBe(50.0);

    const cloned = event.cloneStructure('evt-clone', 'Graduación IT 2027', futureDate);
    expect(cloned.id).toBe('evt-clone');
    expect(cloned.status).toBe('draft');
    expect(cloned.title).toBe('Graduación IT 2027');
  });

  it('cancelEvent debe cancelar en cascada tareas pendientes y contratos no pagados', () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 4);

    const event = new EventEntity({
      id: 'evt-cancel',
      title: 'Gala Pospuesta',
      eventDate: futureDate,
      initialBudget: 80000,
      clientId: 'cli-1',
      status: 'confirmed'
    });

    const tasks = [{ status: 'todo' }, { status: 'completed' }];
    const contracts = [{ status: 'contracted' }, { status: 'paid' }];

    expect(() => event.cancelEvent('')).toThrow(ValidationError);
    event.cancelEvent('Fuerza mayor climática', tasks, contracts);

    expect(event.status).toBe('cancelled');
    expect(tasks[0].status).toBe('cancelled');
    expect(tasks[1].status).toBe('completed');
    expect(contracts[0].status).toBe('cancelled');
    expect(contracts[1].status).toBe('paid');
    expect(() => event.confirmEvent()).toThrow(DomainError);
  });

  it('UserEntity, ClientEntity, VendorEntity y EventServiceEntity deben validar invariantes', () => {
    const user = new UserEntity({
      id: 'u-1',
      name: 'Planner',
      email: 'Planner@Planora.mx',
      passwordHash: 'hash',
      role: 'organizer'
    });
    expect(user.email).toBe('planner@planora.mx');
    expect(UserEntity.isStrongPassword('Planora2026!')).toBe(true);
    expect(UserEntity.isStrongPassword('debil')).toBe(false);
    user.deactivate();
    expect(user.isActive).toBe(false);

    const client = new ClientEntity({
      id: 'c-1',
      organizerId: 'u-1',
      firstName: 'Ana',
      lastName: 'Paz',
      email: 'ana@paz.mx',
      phone: '5512345678'
    });
    client.linkUserAccount('u-cli-1');
    expect(client.userId).toBe('u-cli-1');
    expect(() => client.ensureCanBeDeleted([{ status: 'confirmed' }])).toThrow(DomainError);
    expect(() => client.ensureCanBeDeleted([{ status: 'completed' }])).not.toThrow();

    const vendor = new VendorEntity({
      id: 'v-1',
      organizerId: 'u-1',
      businessName: 'Flores Reales',
      category: 'flowers',
      contactName: 'Rosa',
      email: 'rosa@flores.mx',
      phone: '5511223344',
      rating: 4.5
    });
    vendor.updateRating(4.9);
    expect(vendor.rating).toBe(4.9);
    expect(() => vendor.updateRating(6)).toThrow(ValidationError);

    const contract = new EventServiceEntity({
      id: 'ctr-9',
      eventId: 'evt-1',
      serviceId: 'srv-9',
      serviceName: 'Arreglos Florales',
      vendorName: 'Flores Reales',
      category: 'flowers',
      agreedPrice: 28000,
      status: 'quoted'
    });
    contract.attachContractDocument('contracts/evt-1/flores.pdf');
    expect(contract.status).toBe('contracted');
    const generatedExp = contract.generateExpense('exp-gen-1');
    expect(generatedExp.amount).toBe(28000);
    expect(generatedExp.category).toBe('flowers');
    expect(contract.cancelContract()).toBe(true);
  });
});
