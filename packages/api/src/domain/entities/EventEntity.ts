import { DomainError, ValidationError } from '../errors';
import type { EventStatus, EventType, TaskStatus } from '../types';

export interface EventProps {
  id: string;
  organizerId?: string;
  clientId: string;
  title: string;
  eventType?: EventType;
  status?: EventStatus;
  eventDate: Date | string;
  venueName?: string;
  venueAddress?: string;
  initialBudget: number;
  estimatedGuests?: number;
  cancellationReason?: string | null;
}

export interface TaskProgressLike {
  id: string;
  status: TaskStatus | string;
}

export class EventEntity {
  public readonly id: string;
  public organizerId: string;
  public clientId: string;
  public title: string;
  public eventType: EventType;
  public status: EventStatus;
  public eventDate: Date;
  public venueName: string;
  public venueAddress: string;
  public initialBudget: number;
  public estimatedGuests: number;
  public cancellationReason: string | null;

  constructor(props: EventProps) {
    if (!props.title || !props.title.trim()) {
      throw new ValidationError('El título del evento es obligatorio');
    }
    if (props.initialBudget < 0) {
      throw new ValidationError('El presupuesto inicial del evento no puede ser negativo');
    }

    const parsedDate = props.eventDate instanceof Date ? props.eventDate : new Date(props.eventDate);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new ValidationError('La fecha del evento es inválida');
    }

    this.id = props.id;
    this.organizerId = props.organizerId ?? 'u-org';
    this.clientId = props.clientId;
    this.title = props.title.trim();
    this.eventType = props.eventType ?? 'wedding';
    this.status = props.status ?? 'draft';
    this.eventDate = parsedDate;
    this.venueName = props.venueName ?? 'Sede por definir';
    this.venueAddress = props.venueAddress ?? '';
    this.initialBudget = props.initialBudget;
    this.estimatedGuests = props.estimatedGuests ?? 0;
    this.cancellationReason = props.cancellationReason ?? null;
  }

  public confirmEvent(now: Date = new Date()): boolean {
    if (this.status === 'cancelled') {
      throw new DomainError('No es posible confirmar un evento cancelado', 'EVENT_CANCELLED', 422);
    }
    if (!this.clientId || !this.clientId.trim()) {
      throw new DomainError(
        'No es posible confirmar un evento sin cliente titular asignado',
        'MISSING_CLIENT',
        422
      );
    }
    if (this.initialBudget <= 0) {
      throw new DomainError(
        'No es posible confirmar un evento con presupuesto inicial menor o igual a cero',
        'INVALID_INITIAL_BUDGET',
        422
      );
    }
    if (this.eventDate.getTime() <= now.getTime()) {
      throw new DomainError(
        'No es posible confirmar un evento con fecha en el pasado',
        'PAST_EVENT_DATE',
        422
      );
    }

    this.status = 'confirmed';
    return true;
  }

  public cancelEvent<
    TTask extends { status: string } = { status: string },
    TContract extends { status: string } = { status: string }
  >(
    reason: string,
    tasks: TTask[] = [],
    contracts: TContract[] = []
  ): void {
    if (!reason || !reason.trim()) {
      throw new ValidationError('Debe especificar el motivo de cancelación del evento');
    }
    if (this.status === 'completed') {
      throw new DomainError('No es posible cancelar un evento ya completado', 'EVENT_COMPLETED', 422);
    }

    this.status = 'cancelled';
    this.cancellationReason = reason.trim();

    for (const task of tasks) {
      if (task.status !== 'completed') {
        task.status = 'cancelled';
      }
    }

    for (const contract of contracts) {
      if (contract.status !== 'paid') {
        contract.status = 'cancelled';
      }
    }
  }

  public updateDetails(changes: {
    title?: string;
    eventType?: EventType;
    eventDate?: string | Date;
    venueName?: string;
    venueAddress?: string;
    initialBudget?: number;
    estimatedGuests?: number;
  }): void {
    if (this.status === 'cancelled' || this.status === 'completed') {
      throw new DomainError(
        'No es posible editar un evento cancelado o completado',
        'EVENT_NOT_EDITABLE',
        422
      );
    }
    if (changes.title !== undefined && !changes.title.trim()) {
      throw new ValidationError('El título del evento es obligatorio');
    }
    if (changes.initialBudget !== undefined && changes.initialBudget < 0) {
      throw new ValidationError('El presupuesto inicial del evento no puede ser negativo');
    }
    let parsedDate: Date | undefined;
    if (changes.eventDate !== undefined) {
      parsedDate =
        changes.eventDate instanceof Date ? changes.eventDate : new Date(changes.eventDate);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new ValidationError('La fecha del evento es inválida');
      }
    }

    if (changes.title !== undefined) this.title = changes.title.trim();
    if (changes.eventType !== undefined) this.eventType = changes.eventType;
    if (parsedDate) this.eventDate = parsedDate;
    if (changes.venueName !== undefined) this.venueName = changes.venueName;
    if (changes.venueAddress !== undefined) this.venueAddress = changes.venueAddress;
    if (changes.initialBudget !== undefined) this.initialBudget = changes.initialBudget;
    if (changes.estimatedGuests !== undefined) this.estimatedGuests = changes.estimatedGuests;
  }

  public ensureCanBeDeleted(): void {
    if (this.status !== 'draft' && this.status !== 'cancelled') {
      throw new DomainError(
        'Solo se pueden eliminar eventos en borrador o cancelados',
        'EVENT_NOT_DELETABLE',
        422
      );
    }
  }

  public completeEvent(): boolean {
    if (this.status !== 'confirmed' && this.status !== 'in_progress') {
      throw new DomainError(
        'Solo un evento confirmado o en curso puede marcarse como completado',
        'INVALID_EVENT_TRANSITION',
        422
      );
    }
    this.status = 'completed';
    return true;
  }

  public calculateProgress(tasks: TaskProgressLike[]): number {
    if (!tasks || tasks.length === 0) {
      return 0;
    }
    const completedCount = tasks.filter((t) => t.status === 'completed').length;
    return Number(((completedCount / tasks.length) * 100).toFixed(1));
  }

  public cloneStructure(newId: string, newTitle: string, newDate: Date | string): EventEntity {
    return new EventEntity({
      id: newId,
      organizerId: this.organizerId,
      clientId: this.clientId,
      title: newTitle,
      eventType: this.eventType,
      status: 'draft',
      eventDate: newDate,
      venueName: this.venueName,
      venueAddress: this.venueAddress,
      initialBudget: this.initialBudget,
      estimatedGuests: this.estimatedGuests
    });
  }
}
