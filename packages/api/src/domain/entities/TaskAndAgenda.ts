import { ValidationError } from '../errors';
import type { TaskPriority, TaskStatus } from '../types';

export interface TaskProps {
  id: string;
  eventId: string;
  assignedTo?: string | null;
  title: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate: string;
  completedAt?: string | null;
}

export class TaskEntity {
  public readonly id: string;
  public readonly eventId: string;
  public assignedTo: string | null;
  public title: string;
  public description: string;
  public priority: TaskPriority;
  public status: TaskStatus;
  public dueDate: string;
  public completedAt: string | null;

  constructor(props: TaskProps) {
    if (!props.title || !props.title.trim()) {
      throw new ValidationError('El título de la tarea es obligatorio');
    }
    this.id = props.id;
    this.eventId = props.eventId;
    this.assignedTo = props.assignedTo ?? null;
    this.title = props.title.trim();
    this.description = props.description ?? '';
    this.priority = props.priority ?? 'medium';
    this.status = props.status ?? 'todo';
    this.dueDate = props.dueDate;
    this.completedAt = props.completedAt ?? null;
  }

  public completeTask(completedDate: Date = new Date()): void {
    this.status = 'completed';
    this.completedAt = completedDate.toISOString();
  }

  public reassign(newUserId: string): void {
    this.assignedTo = newUserId;
  }

  public isOverdue(now: Date = new Date()): boolean {
    if (this.status === 'completed' || this.status === 'cancelled') {
      return false;
    }
    return new Date(this.dueDate).getTime() < now.getTime();
  }
}

export interface AgendaItemProps {
  id: string;
  eventId?: string;
  title: string;
  startTime: string;
  endTime: string;
  responsiblePerson?: string;
  locationDetail?: string;
  notes?: string;
  orderIndex?: number;
}

export class AgendaItemEntity {
  public readonly id: string;
  public readonly eventId: string;
  public title: string;
  public startTime: string;
  public endTime: string;
  public responsiblePerson: string;
  public locationDetail: string;
  public notes: string;
  public orderIndex: number;

  constructor(props: AgendaItemProps) {
    const startMins = AgendaItemEntity.toMinutes(props.startTime);
    const endMins = AgendaItemEntity.toMinutes(props.endTime);
    if (startMins >= endMins) {
      throw new ValidationError('La hora de inicio debe ser estrictamente anterior a la hora de término');
    }

    this.id = props.id;
    this.eventId = props.eventId ?? '';
    this.title = props.title.trim();
    this.startTime = props.startTime;
    this.endTime = props.endTime;
    this.responsiblePerson = props.responsiblePerson ?? 'Coordinador General';
    this.locationDetail = props.locationDetail ?? '';
    this.notes = props.notes ?? '';
    this.orderIndex = props.orderIndex ?? 0;
  }

  public reposition(newOrderIndex: number): void {
    this.orderIndex = newOrderIndex;
  }

  public hasTimeConflict(other: AgendaItemEntity): boolean {
    const startA = AgendaItemEntity.toMinutes(this.startTime);
    const endA = AgendaItemEntity.toMinutes(this.endTime);
    const startB = AgendaItemEntity.toMinutes(other.startTime);
    const endB = AgendaItemEntity.toMinutes(other.endTime);

    const overlaps = startA < endB && startB < endA;
    if (!overlaps) {
      return false;
    }

    const sameLocation =
      Boolean(this.locationDetail.trim()) &&
      this.locationDetail.trim().toLowerCase() === other.locationDetail.trim().toLowerCase();
    const sameResponsible =
      Boolean(this.responsiblePerson.trim()) &&
      this.responsiblePerson.trim().toLowerCase() === other.responsiblePerson.trim().toLowerCase();

    return sameLocation || sameResponsible;
  }

  public static toMinutes(hhmm: string): number {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
    if (!match) {
      throw new ValidationError(`Formato horario inválido: ${hhmm}. Use HH:MM (24h)`);
    }
    return Number(match[1]) * 60 + Number(match[2]);
  }
}
