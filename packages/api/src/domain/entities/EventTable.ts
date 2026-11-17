import { ValidationError } from '../errors';

export interface EventTableProps {
  id: string;
  eventId: string;
  tableNumber: number;
  label?: string;
  capacity: number;
}

export class EventTable {
  public readonly id: string;
  public readonly eventId: string;
  public tableNumber: number;
  public label: string;
  public capacity: number;

  constructor(props: EventTableProps) {
    if (!Number.isInteger(props.tableNumber) || props.tableNumber <= 0) {
      throw new ValidationError('El número de mesa debe ser un entero positivo');
    }
    if (!Number.isInteger(props.capacity) || props.capacity <= 0) {
      throw new ValidationError('La capacidad de la mesa debe ser un entero mayor a cero');
    }

    this.id = props.id;
    this.eventId = props.eventId;
    this.tableNumber = props.tableNumber;
    this.label = props.label ?? `Mesa ${String(props.tableNumber).padStart(2, '0')}`;
    this.capacity = props.capacity;
  }

  public availableSeats(currentSeated: number): number {
    return Math.max(0, this.capacity - Math.max(0, currentSeated));
  }
}
